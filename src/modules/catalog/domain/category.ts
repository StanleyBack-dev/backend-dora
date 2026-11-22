// What a record is about (a purchase, a supplier…): part of the catalog,
// shared by the modules. A fixed list, the same for
// every condominium, so reports compare like with like; anything else is
// OTHER with the text typed for it. Codes fit varchar(12).
export enum Category {
  MAINTENANCE = "MAINTENANCE",
  ELECTRICAL = "ELECTRICAL",
  PLUMBING = "PLUMBING",
  PAINTING = "PAINTING",
  CONSTRUCTION = "CONSTRUCTION",
  ELEVATORS = "ELEVATORS",
  CLEANING = "CLEANING",
  PEST_CONTROL = "PEST_CONTROL",
  GARDENING = "GARDENING",
  POOL = "POOL",
  SECURITY = "SECURITY",
  TECHNOLOGY = "TECHNOLOGY",
  OFFICE = "OFFICE",
  FOOD = "FOOD",
  EVENTS = "EVENTS",
  FURNITURE = "FURNITURE",
  UNIFORMS = "UNIFORMS",
  GAS = "GAS",
  PROFESSIONAL = "PROFESSIONAL",
  OTHER = "OTHER",
}

export const ALL_CATEGORIES: readonly Category[] = Object.values(Category);

/** The text typed for OTHER: 2 to 60 characters. */
export const CATEGORY_OTHER_MAX = 60;

export type CategoryChoice = {
  categories: Category[];
  /** What OTHER means, typed (null when OTHER isn't chosen). */
  categoryOther: string | null;
};

/**
 * One or more categories (in the catalog's order, once each) and, with
 * OTHER among them, its text; the same rule for suppliers and requests.
 */
export function normalizeCategories(
  categories: readonly Category[] | null | undefined,
  categoryOther: string | null | undefined,
): CategoryChoice | "categories" | "other" {
  const chosen = new Set(categories ?? []);
  const ordered = ALL_CATEGORIES.filter((category) => chosen.has(category));
  if (ordered.length === 0 || ordered.length !== chosen.size) {
    return "categories";
  }
  if (!ordered.includes(Category.OTHER)) {
    return { categories: ordered, categoryOther: null };
  }
  const text = (categoryOther ?? "").trim().replace(/\s+/g, " ");
  if (text.length < 2 || text.length > CATEGORY_OTHER_MAX) return "other";
  return { categories: ordered, categoryOther: text };
}
