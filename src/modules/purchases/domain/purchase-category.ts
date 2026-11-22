// What a purchase (and a supplier) is about. A fixed list, the same for
// every condominium, so reports compare like with like; anything else is
// OTHER with the text typed for it. Codes fit varchar(12).
export enum PurchaseCategory {
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

export const ALL_PURCHASE_CATEGORIES: readonly PurchaseCategory[] =
  Object.values(PurchaseCategory);
