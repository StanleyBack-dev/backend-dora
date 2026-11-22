import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type { BrandRepositoryPort } from "@/modules/catalog/application/ports/brand-repository.port";
import type { ProductRepositoryPort } from "@/modules/catalog/application/ports/product-repository.port";
import type { PurchaseRequestData } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import type { PurchaseRequestItem } from "@/modules/purchases/domain/purchase-request";

/** The ids not kept from before, once each. */
const newIds = (
  ids: readonly (string | null)[],
  kept: readonly (string | null)[],
) => [
  ...new Set(
    ids.filter((id): id is string => id !== null && !kept.includes(id)),
  ),
];

async function allActive(
  repository: Pick<ProductRepositoryPort | BrandRepositoryPort, "activeIds">,
  condominiumId: string,
  ids: string[],
) {
  if (ids.length === 0) return true;
  const active = await repository.activeIds(condominiumId, ids);
  return active.length === ids.length;
}

/**
 * The products and brands a request's items point to must be active in the
 * condominium's catalog; those the request already had (`current`, on an
 * edit) stay valid even if deactivated since.
 */
export async function assertCatalogAvailable(
  catalog: { products: ProductRepositoryPort; brands: BrandRepositoryPort },
  condominiumId: string,
  items: PurchaseRequestData["items"],
  current: readonly Pick<PurchaseRequestItem, "productId" | "brandId">[] = [],
): Promise<void> {
  const [products, brands] = await Promise.all([
    allActive(
      catalog.products,
      condominiumId,
      newIds(
        items.map((item) => item.productId),
        current.map((item) => item.productId),
      ),
    ),
    allActive(
      catalog.brands,
      condominiumId,
      newIds(
        items.map((item) => item.brandId),
        current.map((item) => item.brandId),
      ),
    ),
  ]);
  if (!products || !brands) {
    throw AppException.from(APP_ERRORS.purchases.catalogUnavailable, undefined);
  }
}
