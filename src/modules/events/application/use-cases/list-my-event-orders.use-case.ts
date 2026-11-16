import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";

// The caller's own orders for an event (newest first).
@Injectable()
export class ListMyEventOrdersUseCase {
  constructor(
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly access: EventAccessService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    eventId: string,
  ): Promise<EventOrder[]> {
    await this.access.condominiumOf(actor);
    return this.orders.listMine(actor.id, eventId);
  }
}
