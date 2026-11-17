import type { UserGroup } from "@/modules/access-control/domain/user-group";

// Who the platform administrator looks for in the directory: a text (name,
// e-mail or user name), a role (the platform's or one in a condominium) and
// a condominium.

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 80;

export type PeopleFilter = {
  /** ILIKE pattern ("%ana%"); null: everyone. */
  pattern: string | null;
  /** ADMIN_MASTER: the platform; the others: a role in a condominium. */
  role: UserGroup | null;
  condominiumId: string | null;
};

/** The text as an ILIKE pattern, its wildcards escaped; null when too short. */
export function searchPattern(value: string | null | undefined): string | null {
  const text = (value ?? "").trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX);
  if (text.length < SEARCH_MIN) return null;
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function normalizePeopleFilter(input: {
  search?: string | null;
  role?: UserGroup | null;
  condominiumId?: string | null;
}): PeopleFilter {
  return {
    pattern: searchPattern(input.search),
    role: input.role ?? null,
    condominiumId: input.condominiumId ?? null,
  };
}
