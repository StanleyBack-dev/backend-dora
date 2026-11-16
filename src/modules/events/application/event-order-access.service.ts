import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";

// Who may see an order: the person who made it, or whoever reviews payments
// (PAYMENTS_MANAGE). Anyone else gets 404, as if it didn't exist.
@Injectable()
export class EventOrderAccessService {
  constructor(
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly access: EventAccessService,
    private readonly permissions: PermissionsService,
  ) {}

  async canReview(actor: AuthenticatedUser): Promise<boolean> {
    return (await this.permissions.effectiveFor(actor)).has(
      Permission.PAYMENTS_MANAGE,
    );
  }

  /** The order, if the caller made it or reviews payments. */
  async load(actor: AuthenticatedUser, id: string): Promise<EventOrder> {
    const condominiumId = await this.access.condominiumOf(actor);
    const order = await this.orders.find(condominiumId, id);
    if (
      !order ||
      (order.userId !== actor.id && !(await this.canReview(actor)))
    ) {
      throw AppException.from(APP_ERRORS.events.orderNotFound, undefined);
    }
    return order;
  }

  /** The order, only for the person who made it. */
  async loadOwn(actor: AuthenticatedUser, id: string): Promise<EventOrder> {
    const condominiumId = await this.access.condominiumOf(actor);
    const order = await this.orders.find(condominiumId, id);
    if (!order || order.userId !== actor.id) {
      throw AppException.from(APP_ERRORS.events.orderNotFound, undefined);
    }
    return order;
  }
}
