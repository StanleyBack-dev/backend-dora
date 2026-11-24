import { requestInvalid as invalid } from "@/modules/purchases/application/purchase-errors";
import type { PurchaseRequestData } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  CATEGORY_OTHER_MAX,
  normalizeCategories,
  type Category,
} from "@/modules/catalog/domain/category";
import {
  PURCHASE_REQUEST_LIMITS as LIMITS,
  PurchasePriority,
} from "@/modules/purchases/domain/purchase-request";
import { requestText } from "@/modules/purchases/domain/purchase-request";
import { isLocalDate } from "@/shared/domain/local-date";

/** A request's form as sent (before the checks). */
export type PurchaseRequestInput = {
  title: string;
  description?: string | null;
  categories: Category[];
  /** Required with OTHER among them ("Outros (digitar)"), ignored otherwise. */
  categoryOther?: string | null;
  priority?: PurchasePriority | null;
  /** A space of the condominium (the location is its name). */
  spaceId?: string | null;
  /** Another place, typed (without a space). */
  location?: string | null;
  /** The local day it is needed by ("2026-12-01"). */
  neededBy?: string | null;
  items: {
    /** A product of the condominium's catalog. */
    productId: string;
    quantity: number;
    unit: string;
    /** A brand of the catalog (null: any brand). */
    brandId?: string | null;
    note?: string | null;
  }[];
};

/** An optional text, or the error saying how long it may be. */
function text(value: string | null | undefined, max: number, label: string) {
  const result = requestText(value, max);
  if (result === undefined)
    throw invalid(`${label} tem até ${max} caracteres.`);
  return result;
}

/**
 * Validates and normalizes a request's form. `today` is the local day; a
 * date before it is refused unless it is the one already saved (an edit
 * that doesn't touch it).
 */
export function validatePurchaseRequestInput(
  input: PurchaseRequestInput,
  today: string,
  savedNeededBy: string | null = null,
): PurchaseRequestData {
  const title = requestText(input.title, LIMITS.title);
  if (!title || title.length < 3) {
    throw invalid(
      `Diga o que precisa ser comprado (de 3 a ${LIMITS.title} caracteres).`,
    );
  }
  const choice = normalizeCategories(input.categories, input.categoryOther);
  if (choice === "categories") {
    throw invalid("Escolha ao menos uma categoria da compra.");
  }
  if (choice === "other") {
    throw invalid(
      `Diga de que é a compra em “Outros” (de 2 a ${CATEGORY_OTHER_MAX} caracteres).`,
    );
  }
  const { categories, categoryOther } = choice;
  const priority = input.priority ?? PurchasePriority.NORMAL;
  if (!Object.values(PurchasePriority).includes(priority)) {
    throw invalid("Escolha a prioridade.");
  }
  const neededBy = input.neededBy?.trim() || null;
  if (neededBy !== null) {
    if (!isLocalDate(neededBy)) throw invalid("Data inválida.");
    if (neededBy < today && neededBy !== savedNeededBy) {
      throw invalid("A data em que precisa não pode estar no passado.");
    }
  }

  const items = input.items ?? [];
  if (items.length === 0 || items.length > LIMITS.maxItems) {
    throw invalid(`Informe de 1 a ${LIMITS.maxItems} itens.`);
  }
  const normalized = items.map((item, index) => {
    const position = `Item ${index + 1}`;
    const productId = item.productId?.trim();
    if (!productId) throw invalid(`${position}: escolha o produto.`);
    const quantity = Number(item.quantity);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > LIMITS.maxQuantity ||
      Math.round(quantity * 100) !== quantity * 100
    ) {
      throw invalid(
        `${position}: a quantidade deve ser maior que zero, com até 2 casas decimais.`,
      );
    }
    const unit = requestText(item.unit, LIMITS.unit);
    if (!unit) {
      throw invalid(
        `${position}: informe a unidade (até ${LIMITS.unit} caracteres).`,
      );
    }
    return {
      productId,
      quantity,
      unit,
      brandId: item.brandId?.trim() || null,
      note: text(item.note, LIMITS.itemNote, `${position}: a observação`),
    };
  });

  return {
    title,
    description: text(input.description, LIMITS.description, "A descrição"),
    categories,
    categoryOther,
    priority,
    spaceId: input.spaceId?.trim() || null,
    location: text(input.location, LIMITS.location, "O local"),
    neededBy,
    items: normalized,
  };
}

/** A cancel reason: 3 to 300 characters. */
export function validateCancelReason(value: string | null | undefined): string {
  const reason = requestText(value, LIMITS.cancelReasonMax);
  if (!reason || reason.length < LIMITS.cancelReasonMin) {
    throw invalid(
      `Diga o motivo do cancelamento (de ${LIMITS.cancelReasonMin} a ${LIMITS.cancelReasonMax} caracteres).`,
    );
  }
  return reason;
}
