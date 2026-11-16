import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
} from "@/modules/events/application/ports/event-repository.port";
import type { EventOrderStatus } from "@/modules/events/domain/event-order";

// Every order of an event, for whoever reviews payments.
@Injectable()
export class ListEventOrdersUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly access: EventAccessService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    eventId: string,
    status: EventOrderStatus | null,
  ): Promise<EventOrder[]> {
    const condominiumId = await this.access.condominiumOf(actor);
    if (!(await this.events.find(condominiumId, eventId))) {
      throw AppException.from(APP_ERRORS.events.notFound, undefined);
    }
    return this.orders.listForEvent(eventId, status);
  }
}
