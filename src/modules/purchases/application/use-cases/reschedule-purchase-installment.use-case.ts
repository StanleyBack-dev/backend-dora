import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  PURCHASE_ORDER_REPOSITORY,
  type PurchaseOrderRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-order-repository.port";
import { orderInvalid } from "@/modules/purchases/application/purchase-errors";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ListPurchaseOrdersUseCase,
  type OrderView,
} from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import { dayInRange } from "@/modules/purchases/domain/purchase-order";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { toLocalDate } from "@/shared/domain/local-date";

/**
 * The management moves an unpaid installment's due day (the boleto came
 * with another date, the supplier agreed on a new one): from the day the
 * order was placed on.
 */
@Injectable()
export class ReschedulePurchaseInstallmentUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    private readonly listing: ListPurchaseOrdersUseCase,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async reschedule(
    actor: AuthenticatedUser,
    requestId: string,
    installmentId: string,
    dueOn: string,
  ): Promise<OrderView> {
    const access = await this.access.orderAccess(actor, "manage");
    const request = await this.listing.loadRequest(access, requestId);
    const order = await this.orders.findByRequest(
      access.condominiumId,
      request.id,
    );
    if (!order) {
      throw AppException.from(APP_ERRORS.purchases.orderNotFound, undefined);
    }
    const timeZone = this.clock.timeZone;
    if (
      !dayInRange(
        dueOn,
        toLocalDate(order.orderedAt, timeZone),
        toLocalDate(this.clock.now(), timeZone),
      )
    ) {
      throw orderInvalid("O vencimento deve ser do dia do pedido em diante.");
    }
    if (!(await this.orders.reschedule(order.id, installmentId, dueOn))) {
      throw AppException.from(APP_ERRORS.purchases.orderChanged, undefined);
    }
    await this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: request.id,
    });
    return this.listing.view(actor, request.id);
  }
}
