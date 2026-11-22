import type { CatalogFilter } from "@/modules/catalog/application/ports/product-repository.port";
import type { Brand, CatalogOption } from "@/modules/catalog/domain/catalog";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export interface BrandRepositoryPort {
  create(condominiumId: string, name: string): Promise<Brand>;
  rename(id: string, name: string): Promise<Brand>;
  setActive(id: string, active: boolean): Promise<Brand>;
  find(condominiumId: string, id: string): Promise<Brand | null>;
  /** The brand with this name there, whatever the case (null: none). */
  findByName(condominiumId: string, name: string): Promise<Brand | null>;
  /** Active first, by name. */
  list(
    condominiumId: string,
    filter: CatalogFilter,
    page: PageRequest,
  ): Promise<Paginated<Brand>>;
  /** Every brand, by name (selects and filters). */
  options(condominiumId: string): Promise<CatalogOption[]>;
  /** Which of these ids are active brands of the condominium. */
  activeIds(condominiumId: string, ids: readonly string[]): Promise<string[]>;
  /** How many are active and inactive. */
  counts(condominiumId: string): Promise<{ active: number; inactive: number }>;
}

export const BRAND_REPOSITORY = Symbol("BRAND_REPOSITORY");
