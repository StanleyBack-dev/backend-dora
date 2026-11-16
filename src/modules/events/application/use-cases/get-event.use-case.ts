import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
  type EventView,
} from "@/modules/events/application/ports/event-repository.port";
import { EventStatus } from "@/modules/events/domain/event";

// One event. A draft exists only for managers: to anyone else it is 404.
@Injectable()
export class GetEventUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    private readonly access: EventAccessService,
  ) {}

  async execute(actor: AuthenticatedUser, id: string): Promise<EventView> {
    const condominiumId = await this.access.condominiumOf(actor);
    const event = await this.events.find(condominiumId, id);
    if (
      !event ||
      (event.status === EventStatus.DRAFT &&
        !(await this.access.canManage(actor)))
    ) {
      throw AppException.from(APP_ERRORS.events.notFound, undefined);
    }
    return event;
  }
}
