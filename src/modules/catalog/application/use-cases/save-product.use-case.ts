import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { CatalogAccessService } from "@/modules/catalog/application/catalog-access.service";
import {
  PRODUCT_REPOSITORY,
  type ProductRepositoryPort,
} from "@/modules/catalog/application/ports/product-repository.port";
import {
  type ProductInput,
  validateProductInput,
} from "@/modules/catalog/application/product-input";
import type { Product } from "@/modules/catalog/domain/catalog";

// Registers a product (from the management's page or while filling
// something in, by whoever uses the catalog: it is chosen right away),
// edits it and activates or deactivates it (the management). A name once
// per condominium, whatever the case.
@Injectable()
export class SaveProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly products: ProductRepositoryPort,
    private readonly access: CatalogAccessService,
    private readonly audit: AuditTrailService,
  ) {}

  private async load(condominiumId: string, id: string): Promise<Product> {
    const product = await this.products.find(condominiumId, id);
    if (!product) {
      throw AppException.from(APP_ERRORS.catalog.productNotFound, undefined);
    }
    return product;
  }

  private async assertNameFree(
    condominiumId: string,
    name: string,
    id: string | null,
  ) {
    const owner = await this.products.findByName(condominiumId, name);
    if (owner && owner.id !== id) {
      throw AppException.from(APP_ERRORS.catalog.productNameTaken, undefined);
    }
  }

  async create(
    actor: AuthenticatedUser,
    input: ProductInput,
  ): Promise<Product> {
    const condominiumId = await this.access.usableBy(actor);
    const data = validateProductInput(input);
    await this.assertNameFree(condominiumId, data.name, null);
    const product = await this.products.create(condominiumId, data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "product",
      entityId: product.id,
      created: true,
    });
    return product;
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: ProductInput,
  ): Promise<Product> {
    const condominiumId = await this.access.managedBy(actor);
    await this.load(condominiumId, id);
    const data = validateProductInput(input);
    await this.assertNameFree(condominiumId, data.name, id);
    const updated = await this.products.update(id, data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "product",
      entityId: id,
    });
    return updated;
  }

  async setActive(
    actor: AuthenticatedUser,
    id: string,
    active: boolean,
  ): Promise<Product> {
    const condominiumId = await this.access.managedBy(actor);
    const product = await this.load(condominiumId, id);
    if (product.active === active) return product;
    const updated = await this.products.setActive(id, active);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "product",
      entityId: id,
    });
    return updated;
  }
}
