import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  SUPPLIER_REPOSITORY,
  type SupplierRepositoryPort,
} from "@/modules/purchases/application/ports/supplier-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import type { Supplier } from "@/modules/purchases/domain/supplier";

// Inactive: no longer offered for new quotes; its history stays.
@Injectable()
export class SetSupplierActiveUseCase {
  constructor(
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    active: boolean,
  ): Promise<Supplier> {
    const condominiumId = await this.access.condominiumOf(actor);
    const supplier = await this.suppliers.find(condominiumId, id);
    if (!supplier) {
      throw AppException.from(APP_ERRORS.purchases.supplierNotFound, undefined);
    }
    if (supplier.active === active) return supplier;
    const updated = await this.suppliers.setActive(id, active);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "supplier",
      entityId: id,
    });
    return updated;
  }
}
