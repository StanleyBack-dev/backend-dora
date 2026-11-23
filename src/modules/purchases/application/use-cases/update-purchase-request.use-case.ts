import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  BRAND_REPOSITORY,
  type BrandRepositoryPort,
} from "@/modules/catalog/application/ports/brand-repository.port";
import {
  PRODUCT_REPOSITORY,
  type ProductRepositoryPort,
} from "@/modules/catalog/application/ports/product-repository.port";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  type PurchaseRequestInput,
  validatePurchaseRequestInput,
} from "@/modules/purchases/application/purchase-request-input";
import { assertCatalogAvailable } from "@/modules/purchases/application/purchase-request-catalog";
import { keepsQuotedScope } from "@/modules/purchases/application/purchase-request-scope";
import { withSpace } from "@/modules/purchases/application/purchase-request-space";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  isDetailsEditableRequest,
  type PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import { SpaceLookupService } from "@/modules/spaces/application/space-lookup.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { toLocalDate } from "@/shared/domain/local-date";

/**
 * Whoever made the request, or the management, edits it: everything while
 * it waits for quotes; in quotes, only what doesn't change the prices
 * (place, date, priority), the title, details, items and categories as
 * they were.
 */
@Injectable()
export class UpdatePurchaseRequestUseCase {
  constructor(
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    @Inject(PRODUCT_REPOSITORY)
    private readonly products: ProductRepositoryPort,
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepositoryPort,
    private readonly access: PurchasesAccessService,
    private readonly spaces: SpaceLookupService,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    input: PurchaseRequestInput,
  ): Promise<PurchaseRequest> {
    const current = await this.access.loadRequest(actor, id);
    if (!isDetailsEditableRequest(current.status)) {
      throw AppException.from(APP_ERRORS.purchases.requestLocked, undefined);
    }
    const today = toLocalDate(this.clock.now(), this.clock.timeZone);
    const data = await withSpace(
      this.spaces,
      current.condominiumId,
      validatePurchaseRequestInput(input, today, current.neededBy),
      current.spaceId,
    );
    if (current.status === PurchaseRequestStatus.QUOTING) {
      if (!keepsQuotedScope(current, data)) {
        throw AppException.from(
          APP_ERRORS.purchases.requestScopeLocked,
          undefined,
        );
      }
      const updated = await this.requests.updateDetails(id, data);
      if (!updated) {
        throw AppException.from(APP_ERRORS.purchases.requestLocked, undefined);
      }
      await this.stamp(actor, id);
      return updated;
    }
    await assertCatalogAvailable(
      { products: this.products, brands: this.brands },
      current.condominiumId,
      data.items,
      current.items,
    );
    const updated = await this.requests.update(id, data);
    await this.stamp(actor, id);
    return updated;
  }

  private stamp(actor: AuthenticatedUser, id: string) {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: id,
    });
  }
}
