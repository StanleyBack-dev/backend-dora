import type { SpaceRules } from "@/modules/spaces/domain/space-rules";

// A shared space of a condominium that residents book: a court, the party
// room, the barbecue area… Each one carries its own booking rules.

export enum SpaceKind {
  COURT = "COURT",
  PARTY_ROOM = "PARTY_ROOM",
  BARBECUE = "BARBECUE",
  POOL = "POOL",
  GYM = "GYM",
  GAME_ROOM = "GAME_ROOM",
  OTHER = "OTHER",
}

export type Space = {
  id: string;
  condominiumId: string;
  name: string;
  kind: SpaceKind;
  description: string | null;
  /** How many people fit (null: not informed). */
  capacity: number | null;
  /** House rules shown before booking ("bring your own ball"). */
  usageRules: string | null;
  /** Inactive: hidden from residents and not bookable (maintenance). */
  active: boolean;
  rules: SpaceRules;
  createdAt: Date;
  updatedAt: Date;
};

export type SpaceDetails = Pick<
  Space,
  "name" | "kind" | "description" | "capacity" | "usageRules"
>;

export type SpaceDetailsViolation =
  "name" | "description" | "capacity" | "usage-rules";

const collapse = (value: string) => value.trim().replace(/[ \t]+/g, " ");
const text = (value: string | null | undefined): string | null => {
  const cleaned = (value ?? "").trim().replace(/\n{3,}/g, "\n\n");
  return cleaned === "" ? null : cleaned;
};

/** Trimmed and validated; the first problem found otherwise. */
export function normalizeSpaceDetails(
  input: SpaceDetails,
): SpaceDetails | SpaceDetailsViolation {
  const name = collapse(input.name);
  if (name.length < 2 || name.length > 80) return "name";

  const description = text(input.description);
  if (description !== null && description.length > 1000) return "description";

  const capacity = input.capacity ?? null;
  if (
    capacity !== null &&
    (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000)
  ) {
    return "capacity";
  }

  const usageRules = text(input.usageRules);
  if (usageRules !== null && usageRules.length > 3000) return "usage-rules";

  return { name, kind: input.kind, description, capacity, usageRules };
}
