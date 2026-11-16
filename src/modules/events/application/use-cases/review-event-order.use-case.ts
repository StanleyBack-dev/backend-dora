import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  confirmedNotice,
  rejectedNotice,
} from "@/modules/events/application/event-order-notices";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";
import {
  EventOrderStatus,
  normalizeRejectReason,
} from "@/modules/events/domain/event-order";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// Whoever reviews payments checks the receipt against the bank statement
// (by the order code) and approves it, or rejects it with a reason. The
// buyer is told either way.
@Injectable()
export class ReviewEventOrderUseCase {
  constructor(
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly access: EventAccessService,
    private readonly outbox: OutboxDispatcher,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  approve(actor: AuthenticatedUser, id: string): Promise<EventOrder> {
    return this.decide(actor, id, EventOrderStatus.CONFIRMED, null);
  }

  reject(
    actor: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<EventOrder> {
    const clean = normalizeRejectReason(reason);
    if (!clean) {
      throw AppException.from(APP_ERRORS.events.invalidRejectReason, undefined);
    }
    return this.decide(actor, id, EventOrderStatus.REJECTED, clean);
  }

  private async decide(
    actor: AuthenticatedUser,
    id: string,
    status: EventOrderStatus.CONFIRMED | EventOrderStatus.REJECTED,
    reason: string | null,
  ): Promise<EventOrder> {
    const condominiumId = await this.access.condominiumOf(actor);
    const order = await this.orders.find(condominiumId, id);
    if (!order) {
      throw AppException.from(APP_ERRORS.events.orderNotFound, undefined);
    }
    if (order.status !== EventOrderStatus.AWAITING_REVIEW) {
      throw AppException.from(APP_ERRORS.events.orderNotUnderReview, undefined);
    }
    const decided = { ...order, status, rejectReason: reason };
    const reviewed = await this.orders.review(
      order.id,
      { status, reviewerId: actor.id, reason, at: this.clock.now() },
      status === EventOrderStatus.CONFIRMED
        ? confirmedNotice(decided)
        : rejectedNotice(decided),
    );
    if (!reviewed) {
      throw AppException.from(APP_ERRORS.events.orderNotUnderReview, undefined);
    }
    this.outbox.kick();
    return reviewed;
  }
}
