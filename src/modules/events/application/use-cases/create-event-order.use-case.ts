import { randomInt } from "crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import { confirmedNotice } from "@/modules/events/application/event-order-notices";
import { EventPaymentService } from "@/modules/events/application/event-payment.service";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
} from "@/modules/events/application/ports/event-repository.port";
import {
  EventStatus,
  isOnSale,
  salesClosesAt,
} from "@/modules/events/domain/event";
import {
  EventOrderStatus,
  normalizeAttendees,
  ORDER_VIOLATION_MESSAGES,
  orderCode,
  orderTotal,
  paymentDeadline,
  type AttendeeInput,
} from "@/modules/events/domain/event-order";
import { ticketCode } from "@/modules/events/domain/event-ticket-entry";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { DependentLookupService } from "@/modules/dependents/application/dependent-lookup.service";
import { localDay } from "@/shared/domain/birth-date";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/** Postgres unique violation (a code drawn twice: draw again). */
const isUniqueViolation = (error: unknown) =>
  (error as { code?: string } | null)?.code === "23505";

// A member orders places for an event: themselves, their approved
// dependents (ages from the birth dates) and other people (name and age
// typed, from outside or not), a ticket each on a ticketed event. With
// something to pay or a document to send, the places are held for 48 h;
// otherwise it is confirmed right away. The places are checked under a lock
// on the event.
@Injectable()
export class CreateEventOrderUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly access: EventAccessService,
    private readonly payment: EventPaymentService,
    private readonly users: UserLookupService,
    private readonly dependents: DependentLookupService,
    private readonly outbox: OutboxDispatcher,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    eventId: string,
    input: AttendeeInput[],
  ): Promise<EventOrder> {
    const condominiumId = await this.access.condominiumOf(actor);
    const event = await this.events.find(condominiumId, eventId);
    if (!event || event.status === EventStatus.DRAFT) {
      throw AppException.from(APP_ERRORS.events.notFound, undefined);
    }
    const now = this.clock.now();
    // Orders until the event's sales close (some hours before the start,
    // or its end); the payment hold never passes it.
    if (!isOnSale(event, now)) {
      throw AppException.from(APP_ERRORS.events.notOnSale, undefined);
    }

    const [birthDate, dependents] = await Promise.all([
      this.users.birthDateOf(actor.id),
      actor.membershipId
        ? this.dependents.approvedOf(actor.membershipId)
        : Promise.resolve([]),
    ]);
    const attendees = normalizeAttendees(input, {
      ticketTypes: event.ticketTypes,
      ticketed: event.ticketed,
      fullPriceCents: event.fullPriceCents ?? 0,
      eventDay: localDay(event.startsAt, this.clock.timeZone),
      self: birthDate ? { name: actor.name, birthDate } : null,
      dependents: new Map(
        dependents.map((dependent) => [dependent.id, dependent]),
      ),
    });
    if (typeof attendees === "string") {
      throw AppException.from(APP_ERRORS.events.orderInvalid, {
        reason: ORDER_VIOLATION_MESSAGES[attendees],
      });
    }
    const totalCents = orderTotal(attendees);
    const paid = totalCents > 0;
    // Something to pay or to prove: the places are held until it is sent.
    const pending = paid || attendees.some((person) => person.needsProof);
    const pix = paid ? await this.payment.pixFor(event) : null;
    if (paid && !pix) {
      throw AppException.from(APP_ERRORS.events.paymentSetupMissing, undefined);
    }
    const unitId = await this.users.memberUnitId(actor.id, condominiumId);

    for (let attempt = 0; ; attempt += 1) {
      const base = {
        condominiumId,
        eventId,
        userId: actor.id,
        unitId,
        code: orderCode(randomInt),
        totalCents,
        // Each person gets a ticket code (drawn again with the order code).
        attendees: attendees.map((person) => ({
          ...person,
          ticketCode: ticketCode(randomInt),
        })),
        pix,
        status: pending
          ? EventOrderStatus.PENDING_PAYMENT
          : EventOrderStatus.CONFIRMED,
        expiresAt: pending ? paymentDeadline(now, salesClosesAt(event)) : null,
      };
      try {
        // Nothing to pay nor prove: confirmed now, the person is told.
        const notices = pending
          ? []
          : confirmedNotice({
              ...base,
              attendees: base.attendees.map((person) => ({
                ...person,
                id: "",
                checkedInAt: null,
              })),
              eventTitle: event.title,
              rejectReason: null,
            });
        const created = await this.orders.create(
          base,
          {
            capacity: event.capacity,
            externalGuestLimit: event.externalGuestLimit,
            unitTicketLimit: event.unitTicketLimit,
          },
          notices,
        );
        if (typeof created === "object" && "held" in created) {
          throw AppException.from(APP_ERRORS.events.alreadyHeld, {
            reason:
              created.held.length === 1
                ? `${created.held[0]} já tem ingresso neste evento.`
                : `${created.held.join(", ")} já têm ingresso neste evento.`,
          });
        }
        if (created === "full") {
          throw AppException.from(APP_ERRORS.events.full, undefined);
        }
        if (created === "outside-full") {
          throw AppException.from(APP_ERRORS.events.outsideFull, undefined);
        }
        if (created === "unit-limit") {
          throw AppException.from(APP_ERRORS.events.unitLimit, {
            limit: event.unitTicketLimit ?? 0,
          });
        }
        if (notices.length > 0) this.outbox.kick();
        return created;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 4) continue;
        throw error;
      }
    }
  }
}
