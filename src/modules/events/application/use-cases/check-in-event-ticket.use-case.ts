import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  EVENT_TICKET_REPOSITORY,
  type EventTicket,
  type EventTicketRepositoryPort,
} from "@/modules/events/application/ports/event-ticket-repository.port";
import type { GateTicket } from "@/modules/events/application/use-cases/list-gate-event-tickets.use-case";
import {
  entryDenial,
  entryOpensAt,
  normalizeTicketCode,
  type EntryDenial,
} from "@/modules/events/domain/event-ticket-entry";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { formatTime } from "@/shared/domain/local-date";

export type TicketTarget = {
  attendeeId?: string | null;
  code?: string | null;
};

// The gate lets a ticket in, by its code (the QR read, or typed) or from
// the day's list, from 3 hours before the event until it ends. A ticket
// enters once: a second read says when it was used (a copied QR). A check-in
// can be undone (wrong person tapped).
@Injectable()
export class CheckInEventTicketUseCase {
  constructor(
    @Inject(EVENT_TICKET_REPOSITORY)
    private readonly tickets: EventTicketRepositoryPort,
    private readonly access: EventAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    target: TicketTarget,
    undo = false,
  ): Promise<GateTicket> {
    const condominiumId = await this.access.condominiumOf(actor);
    const ticket = await this.load(condominiumId, target);
    const now = this.clock.now();
    if (!undo) {
      const denial = entryDenial(ticket, now);
      if (denial) {
        throw AppException.from(APP_ERRORS.events.entryDenied, {
          reason: this.message(denial, ticket),
        });
      }
      if (ticket.checkedInAt) {
        throw AppException.from(APP_ERRORS.events.entryDenied, {
          reason: `Este ingresso já foi usado: ${ticket.name} entrou às ${formatTime(ticket.checkedInAt, this.clock.timeZone)}.`,
        });
      }
    }
    if (undo ? ticket.checkedInAt !== null : true) {
      await this.tickets.setCheckIn(ticket.id, undo ? null : now, actor.id);
    }
    const updated = await this.load(condominiumId, { attendeeId: ticket.id });
    return { ...updated, entryDenial: entryDenial(updated, now) };
  }

  private async load(
    condominiumId: string,
    target: TicketTarget,
  ): Promise<EventTicket> {
    let ticket: EventTicket | null = null;
    if (target.attendeeId) {
      ticket = await this.tickets.find(condominiumId, target.attendeeId);
    } else if (target.code) {
      const code = normalizeTicketCode(target.code);
      const found = code ? await this.tickets.findByCode(code) : null;
      // Another condominium's ticket is "not found" here.
      ticket = found?.condominiumId === condominiumId ? found : null;
    }
    if (!ticket) {
      throw AppException.from(APP_ERRORS.events.ticketNotFound, undefined);
    }
    return ticket;
  }

  private message(denial: EntryDenial, ticket: EventTicket): string {
    if (denial === "not-valid") {
      return ticket.eventStatus === "CANCELLED"
        ? "O evento deste ingresso foi cancelado."
        : "Este ingresso não está confirmado.";
    }
    if (denial === "finished") return "O evento deste ingresso já terminou.";
    return `Ainda é cedo: a entrada do evento abre às ${formatTime(entryOpensAt(ticket.startsAt), this.clock.timeZone)}.`;
  }
}
