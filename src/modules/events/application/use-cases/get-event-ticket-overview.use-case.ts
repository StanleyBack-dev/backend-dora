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
  type EventTicketOverview,
  type EventTicketRepositoryPort,
} from "@/modules/events/application/ports/event-ticket-repository.port";

// An event's tickets at a glance for its managers: the numbers (whatever
// the filters) and what the filters offer.
@Injectable()
export class GetEventTicketOverviewUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    @Inject(EVENT_TICKET_REPOSITORY)
    private readonly repository: EventTicketRepositoryPort,
    private readonly access: EventAccessService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    eventId: string,
  ): Promise<EventTicketOverview> {
    const condominiumId = await this.access.condominiumOf(actor);
    if (!(await this.events.find(condominiumId, eventId))) {
      throw AppException.from(APP_ERRORS.events.notFound, undefined);
    }
    return this.repository.overviewOfEvent(condominiumId, eventId);
  }
}
