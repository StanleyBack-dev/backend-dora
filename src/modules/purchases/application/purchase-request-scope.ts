import type { PurchaseRequestData } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import type { PurchaseRequest } from "@/modules/purchases/domain/purchase-request";

/**
 * The edit keeps what the quotes were made on: the same title, details,
 * items (product, quantity, unit, brand and note, in order) and categories.
 */
export function keepsQuotedScope(
  current: PurchaseRequest,
  data: PurchaseRequestData,
): boolean {
  const sameCategories =
    [...current.categories].sort().join() ===
      [...data.categories].sort().join() &&
    (current.categoryOther ?? null) === data.categoryOther;
  const sameItems =
    current.items.length === data.items.length &&
    current.items.every((item, index) => {
      const next = data.items[index];
      return (
        item.productId === next.productId &&
        item.quantity === next.quantity &&
        item.unit === next.unit &&
        item.brandId === next.brandId &&
        (item.note ?? null) === next.note
      );
    });
  return (
    current.title === data.title &&
    (current.description ?? null) === data.description &&
    sameCategories &&
    sameItems
  );
}
