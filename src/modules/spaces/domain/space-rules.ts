// The booking rules of a space. They are configured here (stage 3) and
// enforced by the bookings module when residents book.

/** 0 = Sunday … 6 = Saturday (same as Date#getDay). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** When the space opens on a weekday; a weekday left out is closed. */
export type OpeningHours = {
  weekday: Weekday;
  /** "HH:MM", local time of the condominium. */
  opensAt: string;
  /** "HH:MM", after opensAt ("24:00" = until midnight). */
  closesAt: string;
};

export enum LimitPeriod {
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
}

/** At most `count` bookings per unit in each `period`. */
export type UnitLimit = { count: number; period: LimitPeriod };

export type SpaceRules = {
  openingHours: OpeningHours[];
  /** Length of each booking slot, in minutes. */
  slotMinutes: number;
  /** A booking starts at least this many hours from now. */
  minAdvanceHours: number;
  /** The calendar opens this many days ahead. */
  maxAdvanceDays: number;
  /** null: no limit per unit. */
  unitLimit: UnitLimit | null;
  /** Bookings wait for a manager's approval. */
  requiresApproval: boolean;
  /** Cancelling is allowed until this many hours before the start. */
  cancelUntilHours: number;
};

export type SpaceRulesViolation =
  | "opening-hours"
  | "opening-hours-slot"
  | "slot"
  | "min-advance"
  | "max-advance"
  | "unit-limit"
  | "cancel";

export const SLOT_STEP_MINUTES = 15;

/** Defaults for a new space: every day 08:00–22:00, 1 h slots. */
export const DEFAULT_RULES: SpaceRules = {
  openingHours: ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => ({
    weekday,
    opensAt: "08:00",
    closesAt: "22:00",
  })),
  slotMinutes: 60,
  minAdvanceHours: 0,
  maxAdvanceDays: 30,
  unitLimit: null,
  requiresApproval: false,
  cancelUntilHours: 0,
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

/** Minutes since midnight of "HH:MM" (null when malformed). */
export function minutesOf(time: string): number | null {
  if (!TIME.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

const isInt = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

/** Validated, opening hours sorted by weekday; the first problem otherwise. */
export function normalizeSpaceRules(
  rules: SpaceRules,
): SpaceRules | SpaceRulesViolation {
  if (
    !isInt(rules.slotMinutes, SLOT_STEP_MINUTES, 24 * 60) ||
    rules.slotMinutes % SLOT_STEP_MINUTES !== 0
  ) {
    return "slot";
  }

  const seen = new Set<number>();
  const openingHours: OpeningHours[] = [];
  for (const day of rules.openingHours) {
    const opens = minutesOf(day.opensAt);
    const closes = minutesOf(day.closesAt);
    if (
      !isInt(day.weekday, 0, 6) ||
      seen.has(day.weekday) ||
      opens === null ||
      closes === null ||
      opens >= closes ||
      day.opensAt === "24:00"
    ) {
      return "opening-hours";
    }
    // A day must fit at least one slot.
    if (closes - opens < rules.slotMinutes) return "opening-hours-slot";
    seen.add(day.weekday);
    openingHours.push({ ...day });
  }
  openingHours.sort((a, b) => a.weekday - b.weekday);

  if (!isInt(rules.minAdvanceHours, 0, 24 * 30)) return "min-advance";
  if (!isInt(rules.maxAdvanceDays, 1, 365)) return "max-advance";
  // The earliest bookable moment must come before the calendar closes.
  if (rules.minAdvanceHours >= rules.maxAdvanceDays * 24) return "max-advance";

  if (
    rules.unitLimit !== null &&
    (!isInt(rules.unitLimit.count, 1, 100) ||
      !Object.values(LimitPeriod).includes(rules.unitLimit.period))
  ) {
    return "unit-limit";
  }

  if (!isInt(rules.cancelUntilHours, 0, 24 * 30)) return "cancel";

  return {
    openingHours,
    slotMinutes: rules.slotMinutes,
    minAdvanceHours: rules.minAdvanceHours,
    maxAdvanceDays: rules.maxAdvanceDays,
    unitLimit: rules.unitLimit ? { ...rules.unitLimit } : null,
    requiresApproval: rules.requiresApproval,
    cancelUntilHours: rules.cancelUntilHours,
  };
}
