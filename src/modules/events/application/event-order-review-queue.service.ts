import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { receiptNotices } from "@/modules/events/application/event-order-notices";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";

// After the buyer sends a receipt or a document: when nothing is missing
// any more the order goes to review and the managers are told.
@Injectable()
export class EventOrderReviewQueue {
  constructor(
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly users: UserLookupService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async whenComplete(
    actor: AuthenticatedUser,
    order: EventOrder,
    at: Date,
  ): Promise<EventOrder> {
    const reviewers = (
      await this.users.activeMemberIds(order.condominiumId, UserGroup.ADMIN)
    ).filter((userId) => userId !== actor.id);
    const moved = await this.orders.advance(order.id, at, (current) =>
      receiptNotices(current, reviewers),
    );
    if (!moved) return order;
    this.outbox.kick();
    return moved;
  }
}
