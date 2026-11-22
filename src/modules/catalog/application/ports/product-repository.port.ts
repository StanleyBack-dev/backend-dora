import type { CatalogOption, Product } from "@/modules/catalog/domain/catalog";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type ProductData = {
  name: string;
  unit: string;
  description: string | null;
};

export type CatalogFilter = {
  /** Exactly this product or brand. */
  id?: string;
  /** true: active only; false: inactive only; undefined: both. */
  active?: boolean;
};

export interface ProductRepositoryPort {
  create(condominiumId: string, data: ProductData): Promise<Product>;
  update(id: string, data: ProductData): Promise<Product>;
  setActive(id: string, active: boolean): Promise<Product>;
  find(condominiumId: string, id: string): Promise<Product | null>;
  /** The product with this name there, whatever the case (null: none). */
  findByName(condominiumId: string, name: string): Promise<Product | null>;
  /** Active first, by name. */
  list(
    condominiumId: string,
    filter: CatalogFilter,
    page: PageRequest,
  ): Promise<Paginated<Product>>;
  /** Every product, by name (selects and filters). */
  options(condominiumId: string): Promise<CatalogOption[]>;
  /** Which of these ids are active products of the condominium. */
  activeIds(condominiumId: string, ids: readonly string[]): Promise<string[]>;
  /** How many are active and inactive. */
  counts(condominiumId: string): Promise<{ active: number; inactive: number }>;
}

export const PRODUCT_REPOSITORY = Symbol("PRODUCT_REPOSITORY");
