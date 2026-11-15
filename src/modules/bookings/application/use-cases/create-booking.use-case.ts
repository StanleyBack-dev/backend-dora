import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  approvalNeededNotice,
  confirmedNotice,
  requestedNotice,
} from "@/modules/bookings/application/booking-notices";
import { BookingPolicyService } from "@/modules/bookings/application/booking-policy.service";
import {
  BOOKING_REPOSITORY,
  SlotTakenError,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  WAITLIST_REPOSITORY,
  type WaitlistRepositoryPort,
} from "@/modules/bookings/application/ports/waitlist-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import {
  BookingStatus,
  normalizeText,
} from "@/modules/bookings/domain/booking";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type CreateBookingInput = {
  spaceId: string;
  startsAt: Date;
  notes?: string | null;
};

/** The notes field (shared by single and weekly bookings). */
export function bookingNotes(value: string | null | undefined): string | null {
  const notes = normalizeText(value, 300);
  if (notes === "too-long") {
    throw AppException.from(APP_ERRORS.bookings.invalidText, {
      reason: "A observação deve ter até 300 caracteres.",
    });
  }
  return notes;
}

// Books one slot of a space under its rules (BookingPolicyService). The
// database refuses an overlapping active booking, so two people clicking
// together can't both get the slot.
@Injectable()
export class CreateBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(WAITLIST_REPOSITORY)
    private readonly waitlist: WaitlistRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly spaces: SpaceForBooking,
    private readonly policy: BookingPolicyService,
    private readonly users: UserLookupService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateBookingInput,
  ): Promise<BookingView> {
    const space = await this.spaces.load(actor, input.spaceId);
    const notes = bookingNotes(input.notes);
    const booker = await this.policy.booker(actor);
    const plan = await this.policy.plan(space, input.startsAt, booker);
    const timeZone = this.clock.timeZone;

    const needsApproval = space.rules.requiresApproval && !booker.manager;
    const reviewers = needsApproval
      ? (
          await this.users.activeMemberIds(
            booker.condominiumId,
            UserGroup.ADMIN,
          )
        ).filter((id) => id !== actor.id)
      : [];

    let created: BookingView;
    try {
      created = await this.bookings.create(
        {
          condominiumId: booker.condominiumId,
          spaceId: space.id,
          userId: actor.id,
          unitId: booker.unitId,
          startsAt: plan.startsAt,
          endsAt: plan.endsAt,
          status: needsApproval
            ? BookingStatus.PENDING
            : BookingStatus.CONFIRMED,
          notes,
          cancelUntil: plan.cancelUntil,
          feeCents: plan.feeCents,
          seriesId: null,
        },
        (booking) => {
          const info = { ...booking, spaceName: space.name };
          return needsApproval
            ? [
                requestedNotice(actor.id, info, timeZone),
                ...reviewers.map((managerId) =>
                  approvalNeededNotice(managerId, info, actor.name, timeZone),
                ),
              ]
            : [confirmedNotice(actor.id, info, timeZone, false)];
        },
      );
    } catch (error) {
      if (error instanceof SlotTakenError) {
        throw AppException.from(APP_ERRORS.bookings.slotTaken, undefined);
      }
      throw error;
    }
    // Got the slot: no longer waiting for it.
    await this.waitlist.leave(space.id, created.startsAt, actor.id);
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "booking",
      entityId: created.id,
      created: true,
    });
    return created;
  }
}
