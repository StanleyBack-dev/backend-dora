import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CatalogAccessService } from "@/modules/catalog/application/catalog-access.service";
import {
  BRAND_REPOSITORY,
  type BrandRepositoryPort,
} from "@/modules/catalog/application/ports/brand-repository.port";
import type { CatalogFilter } from "@/modules/catalog/application/ports/product-repository.port";
import type { Brand, CatalogOption } from "@/modules/catalog/domain/catalog";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/**
 * The condominium's brands: the management's list (filtered and paged
 * here) and counts; the selects of whoever uses the catalog.
 */
@Injectable()
export class ListBrandsUseCase {
  constructor(
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepositoryPort,
    private readonly access: CatalogAccessService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    filter: CatalogFilter,
    page: PageRequest,
  ): Promise<Paginated<Brand>> {
    const condominiumId = await this.access.managedBy(actor);
    return this.brands.list(condominiumId, filter, page);
  }

  async options(actor: AuthenticatedUser): Promise<CatalogOption[]> {
    return this.brands.options(await this.access.usableBy(actor));
  }

  async counts(actor: AuthenticatedUser) {
    return this.brands.counts(await this.access.managedBy(actor));
  }
}
