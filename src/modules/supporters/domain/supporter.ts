// People who support the Dora project (PIX on the "Apoie o Dora" page). A
// static PIX code doesn't tell the app who paid, so the platform
// administrator records each contribution by hand, with the name the person
// agreed to show (or none: "Apoiador anônimo").

export type Supporter = {
  id: string;
  name: string;
  /** False: the ranking shows "Apoiador anônimo" instead of the name. */
  showName: boolean;
  totalCents: number;
  contributions: number;
  /** Calendar date (YYYY-MM-DD) of the latest contribution. */
  lastReceivedOn: string | null;
  createdAt: Date;
};

export type SupportContribution = {
  id: string;
  supporterId: string;
  amountCents: number;
  /** Calendar date (YYYY-MM-DD) the money arrived. */
  receivedOn: string;
  note: string | null;
  createdAt: Date;
};

export type ContributionInput = {
  name: string;
  showName: boolean;
  amountCents: number;
  receivedOn: string;
  note?: string | null;
};

export type ContributionData = {
  name: string;
  showName: boolean;
  amountCents: number;
  receivedOn: string;
  note: string | null;
};

export type ContributionViolation =
  "name" | "amount" | "date" | "future-date" | "note";

/** R$ 100.000,00: a typo guard, not a business rule. */
export const MAX_CONTRIBUTION_CENTS = 10_000_000;
export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const NOTE_MAX = 200;
/** How many supporters the ranking lists. */
export const RANKING_SIZE = 20;

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/** Trimmed name with single spaces; null when too short or too long. */
export function normalizeSupporterName(raw: string): string | null {
  const name = collapse(raw);
  return name.length >= NAME_MIN && name.length <= NAME_MAX ? name : null;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Checked and trimmed; the first problem otherwise. */
export function normalizeContribution(
  input: ContributionInput,
  today: string,
): ContributionData | ContributionViolation {
  const name = normalizeSupporterName(input.name);
  if (!name) return "name";
  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents < 1 ||
    input.amountCents > MAX_CONTRIBUTION_CENTS
  ) {
    return "amount";
  }
  if (!isCalendarDate(input.receivedOn)) return "date";
  if (input.receivedOn > today) return "future-date";
  const note = collapse(input.note ?? "");
  if (note.length > NOTE_MAX) return "note";
  return {
    name,
    showName: input.showName,
    amountCents: input.amountCents,
    receivedOn: input.receivedOn,
    note: note || null,
  };
}

export const CONTRIBUTION_VIOLATION_MESSAGES: Record<
  ContributionViolation,
  string
> = {
  name: `Informe o nome do apoiador (${NAME_MIN} a ${NAME_MAX} caracteres).`,
  amount: "Informe um valor entre R$ 0,01 e R$ 100.000,00.",
  date: "Informe a data em que o apoio chegou.",
  "future-date": "A data do apoio não pode ser no futuro.",
  note: `A observação pode ter até ${NOTE_MAX} caracteres.`,
};

export type RankingRow = {
  supporterId: string;
  name: string;
  showName: boolean;
  totalCents: number;
  contributions: number;
  /** First contribution in the period: breaks ties (who came first). */
  firstReceivedOn: string;
};

export type RankingEntry = {
  /** Shared by equal totals (1, 1, 3…). */
  position: number;
  /** Null when the supporter chose not to show the name. */
  name: string | null;
  totalCents: number;
  contributions: number;
};

/**
 * The top supporters by total, the earliest first on a tie (equal totals
 * share the position). Rows without money are left out.
 */
export function rankSupporters(
  rows: RankingRow[],
  size: number = RANKING_SIZE,
): RankingEntry[] {
  const sorted = rows
    .filter((row) => row.totalCents > 0)
    .sort(
      (a, b) =>
        b.totalCents - a.totalCents ||
        a.firstReceivedOn.localeCompare(b.firstReceivedOn) ||
        a.supporterId.localeCompare(b.supporterId),
    );
  const entries: RankingEntry[] = [];
  for (const [index, row] of sorted.slice(0, size).entries()) {
    const previous = entries[index - 1];
    const position =
      previous && sorted[index - 1].totalCents === row.totalCents
        ? previous.position
        : index + 1;
    entries.push({
      position,
      name: row.showName ? row.name : null,
      totalCents: row.totalCents,
      contributions: row.contributions,
    });
  }
  return entries;
}
