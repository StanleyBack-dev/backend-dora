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
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import {
  boundedText,
  orderInvalid,
} from "@/modules/purchases/application/purchase-errors";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { orderPlacedNotices } from "@/modules/purchases/application/purchase-order-notices";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ListPurchaseOrdersUseCase,
  type OrderView,
} from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import {
  dayInRange,
  monthlyDueDays,
  ORDER_LIMITS,
} from "@/modules/purchases/domain/purchase-order";
import {
  installmentPlan,
  quoteTotals,
} from "@/modules/purchases/domain/purchase-quote";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { toLocalDate } from "@/shared/domain/local-date";

export type PlaceOrderInput = {
  /** The day the delivery is expected (null: not said). */
  expectedOn: string | null;
  /** The first (or only) installment's due day; the others monthly. */
  firstDueOn: string;
  notes: string | null;
};

/**
 * The management places the order of an approved purchase with the chosen
 * supplier: the order (OC-0001) keeps the quote as it was, its installments
 * fall due month by month from the first due day and the request moves to
 * "ordered". The requester and the managers are told.
 */
@Injectable()
export class PlacePurchaseOrderUseCase {
  constructor(
    @Inject(PURCHASE_QUOTE_REPOSITORY)
    private readonly quotes: PurchaseQuoteRepositoryPort,
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    private readonly listing: ListPurchaseOrdersUseCase,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async place(
    actor: AuthenticatedUser,
    requestId: string,
    input: PlaceOrderInput,
  ): Promise<OrderView> {
    const access = await this.access.orderAccess(actor, "manage");
    const request = await this.listing.loadRequest(access, requestId);
    const quote =
      request.status === PurchaseRequestStatus.APPROVED && request.chosenQuoteId
        ? await this.quotes.find(access.condominiumId, request.chosenQuoteId)
        : null;
    if (!quote) {
      throw AppException.from(APP_ERRORS.purchases.notApproved, undefined);
    }
    const now = this.clock.now();
    const today = toLocalDate(now, this.clock.timeZone);
    if (input.expectedOn && !dayInRange(input.expectedOn, today, today)) {
      throw orderInvalid("A entrega prevista deve ser de hoje em diante.");
    }
    if (!dayInRange(input.firstDueOn, today, today)) {
      throw orderInvalid("O vencimento deve ser de hoje em diante.");
    }
    const notes = boundedText(input.notes, ORDER_LIMITS.notes, () =>
      orderInvalid(`As observações vão até ${ORDER_LIMITS.notes} caracteres.`),
    );

    const totals = quoteTotals(
      quote,
      new Map(request.items.map((item) => [item.id, item.quantity])),
    );
    if (!totals.complete) {
      throw orderInvalid(
        "A cotação escolhida não tem preço para todos os itens: devolva para cotação e escolha uma completa.",
      );
    }
    const values = installmentPlan(
      totals.cashCents,
      quote.installments ?? 1,
      quote.installments ? quote.interestRateBp : null,
    );
    const dueDays = monthlyDueDays(input.firstDueOn, values.length);
    const managers = await this.access.managers(access.condominiumId);
    const next = await this.orders.create(
      {
        condominiumId: access.condominiumId,
        requestId: request.id,
        quoteId: quote.id,
        supplierId: quote.supplierId,
        supplierName: quote.supplierName,
        itemsCents: totals.itemsCents,
        totalCents: values.reduce((sum, value) => sum + value, 0),
        paymentMethod: quote.paymentMethod,
        paymentTerms: quote.paymentTerms,
        expectedOn: input.expectedOn,
        notes,
        orderedById: actor.id,
        orderedAt: now,
      },
      values.map((amountCents, index) => ({
        number: index + 1,
        amountCents,
        dueOn: dueDays[index],
      })),
      (number) =>
        orderPlacedNotices(
          request,
          {
            number,
            supplierName: quote.supplierName,
            totalCents: totals.totalCents,
            expectedOn: input.expectedOn,
          },
          { id: actor.id, name: actor.name },
          managers,
        ),
    );
    if (!next) {
      throw AppException.from(APP_ERRORS.purchases.notApproved, undefined);
    }
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: request.id,
    });
    return this.listing.view(actor, request.id);
  }
}
