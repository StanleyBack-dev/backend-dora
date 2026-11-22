import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type { SupplierData } from "@/modules/purchases/application/ports/supplier-repository.port";
import {
  ALL_PURCHASE_CATEGORIES,
  PurchaseCategory,
} from "@/modules/purchases/domain/purchase-category";
import {
  normalizeSupplierDocument,
  SUPPLIER_TEXT_LIMITS,
  SupplierDocumentType,
  supplierText,
} from "@/modules/purchases/domain/supplier";
import { BRAZILIAN_STATES } from "@/shared/domain/brazilian-address";
import { normalizePhone } from "@/shared/domain/phone";
import {
  normalizePixKey,
  PIX_VIOLATION_MESSAGES,
  type PixKeyType,
} from "@/shared/domain/pix";

/** A supplier's form as sent (before the checks). */
export type SupplierInput = {
  documentType: SupplierDocumentType;
  document: string;
  name: string;
  tradeName?: string | null;
  categories: PurchaseCategory[];
  /** Required with OTHER ("Outros (digitar)"), ignored otherwise. */
  categoryOther?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  pixKeyType?: PixKeyType | null;
  pixKey?: string | null;
  notes?: string | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const invalid = (reason: string) =>
  AppException.from(APP_ERRORS.purchases.supplierInvalid, { reason });

/** An optional text, or the error saying how long it may be. */
function text(
  value: string | null | undefined,
  max: number,
  label: string,
): string | null {
  const result = supplierText(value, max);
  if (result === undefined) {
    throw invalid(`${label} tem até ${max} caracteres.`);
  }
  return result;
}

/** Validates and normalizes a supplier's form. */
export function validateSupplierInput(input: SupplierInput): SupplierData {
  const documentType = input.documentType;
  if (!Object.values(SupplierDocumentType).includes(documentType)) {
    throw invalid("Escolha se o fornecedor tem CNPJ ou CPF.");
  }
  const document = normalizeSupplierDocument(documentType, input.document);
  if (!document) {
    throw invalid(
      documentType === SupplierDocumentType.CNPJ
        ? "CNPJ inválido: confira os 14 números."
        : "CPF inválido: confira os 11 números.",
    );
  }
  const name = supplierText(input.name, SUPPLIER_TEXT_LIMITS.name);
  if (!name || name.length < 2) {
    throw invalid(
      `Informe a razão social ou o nome (de 2 a ${SUPPLIER_TEXT_LIMITS.name} caracteres).`,
    );
  }
  // In the catalog's order, once each.
  const chosen = new Set(input.categories ?? []);
  const categories = ALL_PURCHASE_CATEGORIES.filter((category) =>
    chosen.has(category),
  );
  if (categories.length === 0 || categories.length !== chosen.size) {
    throw invalid("Escolha ao menos uma categoria que o fornecedor atende.");
  }
  let categoryOther: string | null = null;
  if (categories.includes(PurchaseCategory.OTHER)) {
    categoryOther =
      supplierText(input.categoryOther, SUPPLIER_TEXT_LIMITS.categoryOther) ??
      null;
    if (!categoryOther || categoryOther.length < 2) {
      throw invalid(
        `Diga o que o fornecedor atende (de 2 a ${SUPPLIER_TEXT_LIMITS.categoryOther} caracteres).`,
      );
    }
  }

  const email = text(input.email, SUPPLIER_TEXT_LIMITS.email, "O e-mail");
  if (email !== null && !EMAIL.test(email)) {
    throw invalid("E-mail inválido.");
  }
  let phone: string | null = null;
  if (input.phone?.trim()) {
    phone = normalizePhone(input.phone);
    if (!phone) {
      throw invalid("Telefone inválido: informe o DDD e o número.");
    }
  }
  const state = input.state?.trim().toUpperCase() || null;
  if (state !== null && !BRAZILIAN_STATES.includes(state)) {
    throw invalid("Escolha o estado (UF) da lista.");
  }

  const pixKeyType = input.pixKeyType ?? null;
  const rawKey = input.pixKey?.trim() || null;
  let pixKey: string | null = null;
  if (pixKeyType !== null || rawKey !== null) {
    if (pixKeyType === null) throw invalid(PIX_VIOLATION_MESSAGES["key-type"]);
    if (rawKey === null) throw invalid("Informe a chave PIX.");
    pixKey = normalizePixKey(pixKeyType, rawKey);
    if (!pixKey) {
      throw invalid(
        PIX_VIOLATION_MESSAGES[
          `key-${pixKeyType.toLowerCase()}` as keyof typeof PIX_VIOLATION_MESSAGES
        ],
      );
    }
  }

  return {
    documentType,
    document,
    name,
    tradeName: text(
      input.tradeName,
      SUPPLIER_TEXT_LIMITS.tradeName,
      "O nome fantasia",
    ),
    categories,
    categoryOther,
    contactName: text(
      input.contactName,
      SUPPLIER_TEXT_LIMITS.contactName,
      "O nome do contato",
    ),
    email: email?.toLowerCase() ?? null,
    phone,
    city: text(input.city, SUPPLIER_TEXT_LIMITS.city, "A cidade"),
    state,
    pixKeyType: pixKey ? pixKeyType : null,
    pixKey,
    notes: text(input.notes, SUPPLIER_TEXT_LIMITS.notes, "As observações"),
  };
}
