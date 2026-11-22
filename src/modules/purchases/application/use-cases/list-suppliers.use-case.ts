import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SUPPLIER_REPOSITORY,
  type SupplierFilter,
  type SupplierFilterOptions,
  type SupplierOverview,
  type SupplierRepositoryPort,
} from "@/modules/purchases/application/ports/supplier-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import type { Supplier } from "@/modules/purchases/domain/supplier";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

// The condominium's suppliers (filtered and paged here), and one of them.
@Injectable()
export class ListSuppliersUseCase {
  constructor(
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly access: PurchasesAccessService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    filter: SupplierFilter,
    page: PageRequest,
  ): Promise<Paginated<Supplier>> {
    const condominiumId = await this.access.condominiumOf(actor);
    const document = filter.document?.replace(/\D/g, "") || undefined;
    return this.suppliers.list(condominiumId, { ...filter, document }, page);
  }

  /** What the filters offer (names, contacts and documents in use). */
  async filterOptions(
    actor: AuthenticatedUser,
  ): Promise<SupplierFilterOptions> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.suppliers.filterOptions(condominiumId);
  }

  /** The suppliers in numbers (the page's cards). */
  async overview(actor: AuthenticatedUser): Promise<SupplierOverview> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.suppliers.overview(condominiumId);
  }

  async get(actor: AuthenticatedUser, id: string): Promise<Supplier> {
    const condominiumId = await this.access.condominiumOf(actor);
    const supplier = await this.suppliers.find(condominiumId, id);
    if (!supplier) {
      throw AppException.from(APP_ERRORS.purchases.supplierNotFound, undefined);
    }
    return supplier;
  }
}
