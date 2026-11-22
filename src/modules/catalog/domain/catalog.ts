// The condominium's catalog: the products and brands the modules that deal
// with things share (purchases now; stock or maintenance later). A name
// once per condominium (whatever the case); deactivated, never deleted,
// so what used them keeps them.

export type Product = {
  id: string;
  condominiumId: string;
  name: string;
  /** The unit it usually comes in ("un", "cx", "kg"…), suggested on use. */
  unit: string;
  /** Details that identify it (size, model…; null: none). */
  description: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Brand = {
  id: string;
  condominiumId: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** A product or brand in a select (the active ones on new uses). */
export type CatalogOption = {
  id: string;
  name: string;
  active: boolean;
  /** Products only: the usual unit. */
  unit?: string;
};

export const CATALOG_LIMITS = {
  productName: 120,
  unit: 12,
  productDescription: 300,
  brandName: 60,
  nameMin: 2,
} as const;

/** Trimmed, single spaces; null when empty or longer than `max`. */
export function catalogText(
  value: string | null | undefined,
  max: number,
): string | null {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return text && text.length <= max ? text : null;
}
