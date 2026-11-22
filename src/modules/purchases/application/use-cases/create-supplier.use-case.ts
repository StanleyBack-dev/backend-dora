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
import {
  type SupplierInput,
  validateSupplierInput,
} from "@/modules/purchases/application/supplier-input";
import type { Supplier } from "@/modules/purchases/domain/supplier";

// Registers a supplier of the condominium (one per CNPJ/CPF there).
@Injectable()
export class CreateSupplierUseCase {
  constructor(
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: SupplierInput,
  ): Promise<Supplier> {
    const condominiumId = await this.access.condominiumOf(actor);
    const data = validateSupplierInput(input);
    if (await this.suppliers.findByDocument(condominiumId, data.document)) {
      throw AppException.from(
        APP_ERRORS.purchases.supplierDocumentTaken,
        undefined,
      );
    }
    const supplier = await this.suppliers.create(condominiumId, data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "supplier",
      entityId: supplier.id,
      created: true,
    });
    return supplier;
  }
}
