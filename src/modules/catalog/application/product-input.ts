import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type { ProductData } from "@/modules/catalog/application/ports/product-repository.port";
import {
  CATALOG_LIMITS as LIMITS,
  catalogText,
} from "@/modules/catalog/domain/catalog";

/** A product's form as sent (before the checks). */
export type ProductInput = {
  name: string;
  unit: string;
  description?: string | null;
};

const invalid = (reason: string) =>
  AppException.from(APP_ERRORS.catalog.productInvalid, { reason });

/** Validates and normalizes a product's form. */
export function validateProductInput(input: ProductInput): ProductData {
  const name = catalogText(input.name, LIMITS.productName);
  if (!name || name.length < LIMITS.nameMin) {
    throw invalid(
      `Informe o nome do produto (de ${LIMITS.nameMin} a ${LIMITS.productName} caracteres).`,
    );
  }
  const unit = catalogText(input.unit, LIMITS.unit);
  if (!unit) {
    throw invalid(`Informe a unidade (até ${LIMITS.unit} caracteres).`);
  }
  const rawDescription = (input.description ?? "").trim();
  const description = catalogText(rawDescription, LIMITS.productDescription);
  if (rawDescription && !description) {
    throw invalid(
      `A descrição tem até ${LIMITS.productDescription} caracteres.`,
    );
  }
  return { name, unit, description };
}
