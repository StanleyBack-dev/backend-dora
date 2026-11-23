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
import { PurchaseOrderFiles } from "@/modules/purchases/application/purchase-order-files";
import { completedNotices } from "@/modules/purchases/application/purchase-order-notices";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ListPurchaseOrdersUseCase,
  type OrderView,
} from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import {
  fullyReceived,
  ORDER_LIMITS,
} from "@/modules/purchases/domain/purchase-order";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { isLocalDate, toLocalDate } from "@/shared/domain/local-date";

export type PaymentInput = { paidOn: string; note: string | null };

const changed = () =>
  AppException.from(APP_ERRORS.purchases.orderChanged, undefined);

/**
 * The management pays the supplier installment by installment: each one is
 * marked paid with the day, a note and the proof, or unmarked when marked by
 * mistake. Paid and received in full, the purchase is completed and the
 * requester and the managers are told.
 */
@Injectable()
export class PayPurchaseInstallmentUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    private readonly listing: ListPurchaseOrdersUseCase,
    private readonly files: PurchaseOrderFiles,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async pay(
    actor: AuthenticatedUser,
    requestId: string,
    installmentId: string,
    input: PaymentInput,
    file: string | null,
  ): Promise<OrderView> {
    const { access, request, order } = await this.load(actor, requestId);
    const installment = order.installments.find(
      (item) => item.id === installmentId,
    );
    if (!installment || installment.paidOn !== null) throw changed();
    const now = this.clock.now();
    if (
      !isLocalDate(input.paidOn) ||
      input.paidOn > toLocalDate(now, this.clock.timeZone)
    ) {
      throw orderInvalid("A data do pagamento não pode ser no futuro.");
    }
    const note = boundedText(input.note, ORDER_LIMITS.paymentNote, () =>
      orderInvalid(
        `A observação vai até ${ORDER_LIMITS.paymentNote} caracteres.`,
      ),
    );

    const lastOne = order.installments.every(
      (item) => item.id === installment.id || item.paidOn !== null,
    );
    const notices =
      lastOne && fullyReceived(request.items, order.receipts)
        ? completedNotices(
            request,
            order,
            { id: actor.id, name: actor.name },
            await this.access.managers(access.condominiumId),
            now,
          )
        : [];
    const stored = await this.files.store(access.condominiumId, file);
    const paid = await this.orders
      .payInstallment(
        order.id,
        installment.id,
        {
          paidOn: input.paidOn,
          paidById: actor.id,
          proofKey: stored.key,
          proofIsPdf: stored.isPdf,
          note,
        },
        notices,
      )
      .catch(async (cause: unknown) => {
        await this.files.drop(stored.key);
        throw cause;
      });
    if (!paid) {
      await this.files.drop(stored.key);
      throw changed();
    }
    await this.stamp(actor, request.id);
    return this.listing.view(actor, request.id);
  }

  async unpay(
    actor: AuthenticatedUser,
    requestId: string,
    installmentId: string,
  ): Promise<OrderView> {
    const { request, order } = await this.load(actor, requestId);
    const proofKey = await this.orders.unpayInstallment(
      order.id,
      installmentId,
    );
    if (proofKey === undefined) throw changed();
    await this.files.drop(proofKey);
    await this.stamp(actor, request.id);
    return this.listing.view(actor, request.id);
  }

  private async load(actor: AuthenticatedUser, requestId: string) {
    const access = await this.access.orderAccess(actor, "manage");
    const request = await this.listing.loadRequest(access, requestId);
    const order = await this.orders.findByRequest(
      access.condominiumId,
      request.id,
    );
    if (!order) {
      throw AppException.from(APP_ERRORS.purchases.orderNotFound, undefined);
    }
    return { access, request, order };
  }

  private stamp(actor: AuthenticatedUser, requestId: string) {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: requestId,
    });
  }
}
