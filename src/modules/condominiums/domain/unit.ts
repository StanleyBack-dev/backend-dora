// A unit (apartment, house) of a condominium. Residents are linked to one;
// limits like "bookings per unit" count by it. In apartments it is a block
// (empty: no blocks) and a number; in houses (AddressFormat.HOUSE) a street,
// a quadra (kept as the block) and a lote (kept as the number).

export type Unit = {
  id: string;
  condominiumId: string;
  /** The street of a house ("" in apartments). */
  street: string;
  block: string;
  number: string;
};

/** Most units created at once (a whole tower fits; typos don't explode). */
export const MAX_UNITS_PER_BATCH = 500;

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/** "" (no block) or up to 30 characters. */
export function normalizeBlock(
  value: string | null | undefined,
): string | null {
  const block = collapse(value ?? "");
  return block.length <= 30 ? block : null;
}

/** The street of a house: 2 to 80 characters (null otherwise). */
export function normalizeStreet(
  value: string | null | undefined,
): string | null {
  const street = collapse(value ?? "");
  return street.length >= 2 && street.length <= 80 ? street : null;
}

export function normalizeUnitNumber(value: string): string | null {
  const number = collapse(value);
  return number.length >= 1 && number.length <= 20 ? number : null;
}

/**
 * Address detail inside the condominium ("casa dos fundos"): trimmed, null
 * when empty, "too-long" past 80 characters.
 */
export function normalizeUnitComplement(
  value: string | null | undefined,
): string | null | "too-long" {
  const complement = collapse(value ?? "");
  if (complement === "") return null;
  return complement.length <= 80 ? complement : "too-long";
}

/**
 * How a unit is shown: "Bloco A · 101" or just "101" (apartments), "Rua das
 * Flores, Qd 3, Lt 12" (houses).
 */
export function unitLabel(
  unit: Pick<Unit, "block" | "number"> & { street?: string | null },
): string {
  if (unit.street) {
    return `${unit.street}, Qd ${unit.block}, Lt ${unit.number}`;
  }
  return unit.block ? `${unit.block} · ${unit.number}` : unit.number;
}

/** Same unit regardless of case ("bloco a" = "Bloco A"). */
export const unitKey = (unit: Pick<Unit, "block" | "number">): string =>
  `${unit.block.toLowerCase()}|${unit.number.toLowerCase()}`;

export type UnitNumbersError = "empty" | "invalid" | "too-many";

/**
 * The numbers typed for a batch: separated by commas, semicolons or line
 * breaks, with numeric ranges ("101-104, 201" → 101, 102, 103, 104, 201).
 * Ranges keep the width of their first number ("01-03" → 01, 02, 03).
 */
export function expandUnitNumbers(text: string): string[] | UnitNumbersError {
  const tokens = text
    .split(/[,;\n]/)
    .map((token) => collapse(token))
    .filter(Boolean);
  if (tokens.length === 0) return "empty";

  const numbers: string[] = [];
  const seen = new Set<string>();
  const push = (value: string): boolean => {
    const number = normalizeUnitNumber(value);
    if (!number) return false;
    if (!seen.has(number.toLowerCase())) {
      seen.add(number.toLowerCase());
      numbers.push(number);
    }
    return true;
  };

  for (const token of tokens) {
    const range = /^(\d{1,6})\s*-\s*(\d{1,6})$/.exec(token);
    if (range) {
      const [, first, last] = range as unknown as [string, string, string];
      const from = Number(first);
      const to = Number(last);
      if (to < from) return "invalid";
      if (to - from + 1 > MAX_UNITS_PER_BATCH) return "too-many";
      for (let value = from; value <= to; value += 1) {
        push(String(value).padStart(first.length, "0"));
      }
    } else if (!push(token)) {
      return "invalid";
    }
    if (numbers.length > MAX_UNITS_PER_BATCH) return "too-many";
  }
  return numbers;
}

/** Whether a unit has active members linked (a units page filter). */
export enum UnitOccupancy {
  OCCUPIED = "OCCUPIED",
  EMPTY = "EMPTY",
}
