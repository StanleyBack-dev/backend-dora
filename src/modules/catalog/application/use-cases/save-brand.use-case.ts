import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { CatalogAccessService } from "@/modules/catalog/application/catalog-access.service";
import {
  BRAND_REPOSITORY,
  type BrandRepositoryPort,
} from "@/modules/catalog/application/ports/brand-repository.port";
import {
  type Brand,
  CATALOG_LIMITS as LIMITS,
  catalogText,
} from "@/modules/catalog/domain/catalog";

const brandName = (value: string) => {
  const name = catalogText(value, LIMITS.brandName);
  if (!name || name.length < LIMITS.nameMin) {
    throw AppException.from(APP_ERRORS.catalog.brandInvalid, undefined);
  }
  return name;
};

// Registers a brand (from the management's page or while filling something
// in, by whoever uses the catalog: it is chosen right away), renames it and
// activates or deactivates it (the management). A name once per
// condominium, whatever the case.
@Injectable()
export class SaveBrandUseCase {
  constructor(
    @Inject(BRAND_REPOSITORY) private readonly brands: BrandRepositoryPort,
    private readonly access: CatalogAccessService,
    private readonly audit: AuditTrailService,
  ) {}

  private async load(condominiumId: string, id: string): Promise<Brand> {
    const brand = await this.brands.find(condominiumId, id);
    if (!brand) {
      throw AppException.from(APP_ERRORS.catalog.brandNotFound, undefined);
    }
    return brand;
  }

  private async assertNameFree(
    condominiumId: string,
    name: string,
    id: string | null,
  ) {
    const owner = await this.brands.findByName(condominiumId, name);
    if (owner && owner.id !== id) {
      throw AppException.from(APP_ERRORS.catalog.brandNameTaken, undefined);
    }
  }

  async create(actor: AuthenticatedUser, nameInput: string): Promise<Brand> {
    const condominiumId = await this.access.usableBy(actor);
    const name = brandName(nameInput);
    await this.assertNameFree(condominiumId, name, null);
    const brand = await this.brands.create(condominiumId, name);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "brand",
      entityId: brand.id,
      created: true,
    });
    return brand;
  }

  async rename(
    actor: AuthenticatedUser,
    id: string,
    nameInput: string,
  ): Promise<Brand> {
    const condominiumId = await this.access.managedBy(actor);
    const brand = await this.load(condominiumId, id);
    const name = brandName(nameInput);
    if (name === brand.name) return brand;
    await this.assertNameFree(condominiumId, name, id);
    const renamed = await this.brands.rename(id, name);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "brand",
      entityId: id,
    });
    return renamed;
  }

  async setActive(
    actor: AuthenticatedUser,
    id: string,
    active: boolean,
  ): Promise<Brand> {
    const condominiumId = await this.access.managedBy(actor);
    const brand = await this.load(condominiumId, id);
    if (brand.active === active) return brand;
    const updated = await this.brands.setActive(id, active);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "brand",
      entityId: id,
    });
    return updated;
  }
}
