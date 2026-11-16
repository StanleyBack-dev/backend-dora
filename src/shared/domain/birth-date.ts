// A person's birth date (YYYY-MM-DD, a calendar date: no time zone) and the
// age it gives on a day. Used to price event tickets by age without asking.

export const BIRTH_DATE_MIN = "1900-01-01";

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The date when it is real and between 1900 and `today`; null otherwise. */
export function normalizeBirthDate(
  value: string | null | undefined,
  today: string,
): string | null {
  const clean = value?.trim() ?? "";
  const match = DATE.exec(clean);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const real =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d;
  return real && clean >= BIRTH_DATE_MIN && clean <= today ? clean : null;
}

/** Whole years completed on `on` (both YYYY-MM-DD). */
export function ageOn(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  const birthdayPassed = m > bm || (m === bm && d >= bd);
  return y - by - (birthdayPassed ? 0 : 1);
}

/** A moment as a calendar date in a time zone ("2026-12-20"). */
export const localDay = (at: Date, timeZone: string): string =>
  at.toLocaleDateString("en-CA", { timeZone });
