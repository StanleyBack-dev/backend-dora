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
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ListPurchaseOrdersUseCase,
  type OrderView,
} from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import {
  ORDER_LIMITS,
  ORDER_RATING_SOURCE,
} from "@/modules/purchases/domain/purchase-order";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import {
  SUPPLIER_REPOSITORY,
  type SupplierRepositoryPort,
} from "@/modules/suppliers/application/ports/supplier-repository.port";

/**
 * Once a purchase is completed (received and paid) the management rates the
 * supplier, 1 to 5 and a comment; rating again replaces it. The suppliers
 * registry shows each supplier's average.
 */
@Injectable()
export class RatePurchaseSupplierUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly listing: ListPurchaseOrdersUseCase,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
  ) {}

  async rate(
    actor: AuthenticatedUser,
    requestId: string,
    rating: number,
    commentInput: string | null,
  ): Promise<OrderView> {
    const access = await this.access.orderAccess(actor, "manage");
    const request = await this.listing.loadRequest(access, requestId);
    const order =
      request.status === PurchaseRequestStatus.COMPLETED
        ? await this.orders.findByRequest(access.condominiumId, request.id)
        : null;
    if (!order) {
      throw AppException.from(APP_ERRORS.purchases.notCompleted, undefined);
    }
    if (!order.supplierId) {
      throw orderInvalid("O fornecedor deste pedido não está mais cadastrado.");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw orderInvalid("A nota vai de 1 a 5 estrelas.");
    }
    const comment = boundedText(commentInput, ORDER_LIMITS.ratingComment, () =>
      orderInvalid(
        `O comentário vai até ${ORDER_LIMITS.ratingComment} caracteres.`,
      ),
    );
    await this.suppliers.rate(
      order.supplierId,
      { source: ORDER_RATING_SOURCE, sourceId: order.id },
      rating,
      comment,
      actor.id,
    );
    await this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: request.id,
    });
    return this.listing.view(actor, request.id);
  }
}
