import type { Category } from "@/modules/catalog/domain/category";
import { isValidCnpj } from "@/shared/domain/cnpj";
import { normalizeCpf } from "@/shared/domain/identity-document";
import type { PixKeyType } from "@/shared/domain/pix";

// A supplier of the condominium: a company (CNPJ) or a self-employed person
// (CPF). The document is unique in the condominium; once used a supplier is
// deactivated, never deleted.

export enum SupplierDocumentType {
  CNPJ = "CNPJ",
  CPF = "CPF",
}

export type Supplier = {
  id: string;
  condominiumId: string;
  documentType: SupplierDocumentType;
  /** Digits only (14 for a CNPJ, 11 for a CPF). */
  document: string;
  /** Razão social, or the person's name. */
  name: string;
  /** Nome fantasia (null: none). */
  tradeName: string | null;
  categories: Category[];
  /** What it serves, typed, when OTHER is among them (null otherwise). */
  categoryOther: string | null;
  contactName: string | null;
  email: string | null;
  /** Digits only, with the area code. */
  phone: string | null;
  city: string | null;
  /** Two-letter state (UF). */
  state: string | null;
  pixKeyType: PixKeyType | null;
  pixKey: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Limits of the free-text fields (characters). */
export const SUPPLIER_TEXT_LIMITS = {
  name: 120,
  categoryOther: 60,
  tradeName: 120,
  contactName: 80,
  email: 160,
  city: 60,
  notes: 500,
} as const;

/** The document's digits when valid for its type (null otherwise). */
export function normalizeSupplierDocument(
  type: SupplierDocumentType,
  raw: string,
): string | null {
  if (type === SupplierDocumentType.CPF) return normalizeCpf(raw);
  if (!/^[\d./\s-]+$/.test(raw.trim())) return null;
  const digits = raw.replace(/\D/g, "");
  return isValidCnpj(digits) ? digits : null;
}

/** Trimmed text with single spaces (null: empty; undefined: too long). */
export function supplierText(
  value: string | null | undefined,
  max: number,
): string | null | undefined {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= max ? text : undefined;
}
