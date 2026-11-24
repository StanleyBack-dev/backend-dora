import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  PURCHASE_ORDER_REPOSITORY,
  type PurchaseOrderRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-order-repository.port";
import {
  boundedText,
  orderInvalid,
} from "@/modules/purchases/application/purchase-errors";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { orderCancelledNotices } from "@/modules/purchases/application/purchase-order-notices";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ListPurchaseOrdersUseCase,
  type OrderView,
} from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import { ORDER_LIMITS } from "@/modules/purchases/domain/purchase-order";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const NOT_CANCELLABLE =
  "O pedido não pode mais ser cancelado: já chegou entrega ou foi feito pagamento. Desfaça-os antes.";

/**
 * The management cancels a placed order (the supplier won't deliver, the
 * order was wrong…) while nothing arrived nor was paid, with the reason. The
 * purchase goes back to "approved", ready for a new order, or back to the
 * quotes to choose another supplier (then there is no order page: null);
 * the requester and the managers are told.
 */
@Injectable()
export class CancelPurchaseOrderUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    private readonly listing: ListPurchaseOrdersUseCase,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async cancel(
    actor: AuthenticatedUser,
    requestId: string,
    reasonInput: string,
    backToQuotes = false,
  ): Promise<OrderView | null> {
    const access = await this.access.orderAccess(actor, "manage");
    const request = await this.listing.loadRequest(access, requestId);
    const order = await this.orders.findByRequest(
      access.condominiumId,
      request.id,
    );
    if (!order) {
      throw AppException.from(APP_ERRORS.purchases.orderNotFound, undefined);
    }
    const reason = boundedText(reasonInput, ORDER_LIMITS.cancelReason, () =>
      orderInvalid(`O motivo vai até ${ORDER_LIMITS.cancelReason} caracteres.`),
    );
    if (!reason || reason.length < 3) {
      throw orderInvalid("Diga o motivo (ao menos 3 letras).");
    }
    if (
      order.receipts.length > 0 ||
      order.installments.some((installment) => installment.paidOn !== null)
    ) {
      throw orderInvalid(NOT_CANCELLABLE);
    }
    const notices = orderCancelledNotices(
      request,
      order,
      { id: actor.id, name: actor.name },
      { reason, backToQuotes },
      await this.access.managers(access.condominiumId),
      this.clock.now(),
    );
    const cancelled = await this.orders.cancel(
      order.id,
      { by: actor.id, reason, backToQuotes },
      notices,
    );
    if (!cancelled) throw orderInvalid(NOT_CANCELLABLE);
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: request.id,
    });
    return backToQuotes ? null : this.listing.view(actor, request.id);
  }
}
