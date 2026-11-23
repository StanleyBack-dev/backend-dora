import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
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
import { withSpace } from "@/modules/purchases/application/purchase-request-space";
import { requestCreatedNotices } from "@/modules/purchases/application/purchase-request-notices";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import type { PurchaseRequest } from "@/modules/purchases/domain/purchase-request";
import { SpaceLookupService } from "@/modules/spaces/application/space-lookup.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { toLocalDate } from "@/shared/domain/local-date";

/**
 * Someone of the team asks for a purchase: the request is numbered in the
 * condominium (SC-0001…) and the managers are told.
 */
@Injectable()
export class CreatePurchaseRequestUseCase {
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
    input: PurchaseRequestInput,
  ): Promise<PurchaseRequest> {
    const { condominiumId } = await this.access.scopeOf(actor);
    const today = toLocalDate(this.clock.now(), this.clock.timeZone);
    const data = await withSpace(
      this.spaces,
      condominiumId,
      validatePurchaseRequestInput(input, today),
    );
    await assertCatalogAvailable(
      { products: this.products, brands: this.brands },
      condominiumId,
      data.items,
    );
    const managers = await this.access.managers(condominiumId);
    const request = await this.requests.create(
      condominiumId,
      actor.id,
      data,
      (created) => requestCreatedNotices(created, managers),
    );
    await this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: request.id,
      created: true,
    });
    return request;
  }
}
