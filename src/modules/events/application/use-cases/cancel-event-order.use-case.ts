import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { EventOrderAccessService } from "@/modules/events/application/event-order-access.service";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The buyer gives up an unpaid order: its places go back right away.
@Injectable()
export class CancelEventOrderUseCase {
  constructor(
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly access: EventOrderAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(actor: AuthenticatedUser, id: string): Promise<EventOrder> {
    const order = await this.access.loadOwn(actor, id);
    const cancelled = await this.orders.cancel(order.id, this.clock.now());
    if (!cancelled) {
      throw AppException.from(APP_ERRORS.events.orderNotPending, undefined);
    }
    return cancelled;
  }
}
