import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
} from "@/modules/events/application/ports/event-repository.port";
import {
  EVENT_TICKET_REPOSITORY,
  type EventTicketRepositoryPort,
} from "@/modules/events/application/ports/event-ticket-repository.port";
import type { GateTicket } from "@/modules/events/application/use-cases/list-gate-event-tickets.use-case";
import { entryDenial } from "@/modules/events/domain/event-ticket-entry";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// An event's tickets and entries for its managers (Gestão, Eventos): every
// person of the confirmed orders and whether they came in.
@Injectable()
export class ListEventTicketsUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    @Inject(EVENT_TICKET_REPOSITORY)
    private readonly tickets: EventTicketRepositoryPort,
    private readonly access: EventAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    eventId: string,
  ): Promise<GateTicket[]> {
    const condominiumId = await this.access.condominiumOf(actor);
    if (!(await this.events.find(condominiumId, eventId))) {
      throw AppException.from(APP_ERRORS.events.notFound, undefined);
    }
    const now = this.clock.now();
    return (await this.tickets.forEvent(condominiumId, eventId)).map(
      (ticket) => ({ ...ticket, entryDenial: entryDenial(ticket, now) }),
    );
  }
}
