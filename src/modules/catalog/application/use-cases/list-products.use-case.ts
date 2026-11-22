import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CatalogAccessService } from "@/modules/catalog/application/catalog-access.service";
import {
  type CatalogFilter,
  PRODUCT_REPOSITORY,
  type ProductRepositoryPort,
} from "@/modules/catalog/application/ports/product-repository.port";
import type { CatalogOption, Product } from "@/modules/catalog/domain/catalog";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

// The condominium's products: the management's list (filtered and paged
// here) and counts; the selects of whoever uses the catalog.
@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly products: ProductRepositoryPort,
    private readonly access: CatalogAccessService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    filter: CatalogFilter,
    page: PageRequest,
  ): Promise<Paginated<Product>> {
    const condominiumId = await this.access.managedBy(actor);
    return this.products.list(condominiumId, filter, page);
  }

  async options(actor: AuthenticatedUser): Promise<CatalogOption[]> {
    return this.products.options(await this.access.usableBy(actor));
  }

  async counts(actor: AuthenticatedUser) {
    return this.products.counts(await this.access.managedBy(actor));
  }
}
