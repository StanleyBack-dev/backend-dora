import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";
import type { EventOrderStatus } from "@/modules/events/domain/event-order";

// The orders of every event of the condominium in one queue (Gestão,
// Eventos, Pedidos), oldest first, for whoever reviews payments; by status
// and, optionally, one event.
@Injectable()
export class ListOrdersQueueUseCase {
  constructor(
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly access: EventAccessService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    filter: { status: EventOrderStatus | null; eventId: string | null },
  ): Promise<EventOrder[]> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.orders.listForCondominium(condominiumId, filter);
  }
}
