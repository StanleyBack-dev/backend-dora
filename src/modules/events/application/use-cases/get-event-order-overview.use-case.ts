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
  EVENT_ORDER_REPOSITORY,
  type EventOrderOverview,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";

// An event's orders at a glance for whoever reviews payments: the numbers
// (whatever the filters) and what the filters offer.
@Injectable()
export class GetEventOrderOverviewUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly repository: EventOrderRepositoryPort,
    private readonly access: EventAccessService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    eventId: string,
  ): Promise<EventOrderOverview> {
    const condominiumId = await this.access.condominiumOf(actor);
    if (!(await this.events.find(condominiumId, eventId))) {
      throw AppException.from(APP_ERRORS.events.notFound, undefined);
    }
    return this.repository.overviewOfEvent(eventId);
  }
}
