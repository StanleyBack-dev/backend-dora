import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  SUPPLIER_REPOSITORY,
  type SupplierRepositoryPort,
} from "@/modules/suppliers/application/ports/supplier-repository.port";
import { SuppliersAccessService } from "@/modules/suppliers/application/suppliers-access.service";
import {
  type SupplierInput,
  validateSupplierInput,
} from "@/modules/suppliers/application/supplier-input";
import type { Supplier } from "@/modules/suppliers/domain/supplier";

/**
 * Edits a supplier's details (the CNPJ/CPF may be corrected, as long as no
 * other supplier there has it).
 */
@Injectable()
export class UpdateSupplierUseCase {
  constructor(
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly access: SuppliersAccessService,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    input: SupplierInput,
  ): Promise<Supplier> {
    const condominiumId = await this.access.managedBy(actor);
    const current = await this.suppliers.find(condominiumId, id);
    if (!current) {
      throw AppException.from(APP_ERRORS.suppliers.notFound, undefined);
    }
    const data = validateSupplierInput(input);
    const owner = await this.suppliers.findByDocument(
      condominiumId,
      data.document,
    );
    if (owner && owner.id !== id) {
      throw AppException.from(APP_ERRORS.suppliers.documentTaken, undefined);
    }
    const updated = await this.suppliers.update(id, data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "supplier",
      entityId: id,
    });
    return updated;
  }
}
