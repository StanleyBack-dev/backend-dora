import {
  addDays,
  daysBetween,
  startOfLocalDate,
  toLocalDate,
} from "@/shared/domain/local-date";
import type { SpaceRules } from "@/modules/spaces/domain/space-rules";
import { LimitPeriod, minutesOf } from "@/modules/spaces/domain/space-rules";

// When a space can be booked: the slots of a day (from its opening hours)
// and whether an instant is a bookable start under the space's rules. All
// calendar math is in the condominium's time zone.

export type Slot = { startsAt: Date; endsAt: Date };

/** 0 = Sunday … 6 = Saturday of a YYYY-MM-DD date. */
export function weekdayOf(localDate: string): number {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * The slots of a calendar date: from opening, one slot after another while
 * a whole slot fits before closing. Empty on a closed day.
 */
export function slotsOfDay(
  localDate: string,
  rules: Pick<SpaceRules, "openingHours" | "slotMinutes">,
  timeZone: string,
): Slot[] {
  const day = rules.openingHours.find(
    (item) => item.weekday === weekdayOf(localDate),
  );
  if (!day) return [];
  const opens = minutesOf(day.opensAt) ?? 0;
  const closes = minutesOf(day.closesAt) ?? 0;
  const midnight = startOfLocalDate(localDate, timeZone).getTime();
  const slots: Slot[] = [];
  for (
    let start = opens;
    start + rules.slotMinutes <= closes;
    start += rules.slotMinutes
  ) {
    slots.push({
      startsAt: new Date(midnight + start * 60_000),
      endsAt: new Date(midnight + (start + rules.slotMinutes) * 60_000),
    });
  }
  return slots;
}

/** The calendar dates residents can book: today … today + maxAdvanceDays. */
export function bookingWindow(
  rules: Pick<SpaceRules, "maxAdvanceDays">,
  now: Date,
  timeZone: string,
): { firstDate: string; lastDate: string } {
  const today = toLocalDate(now, timeZone);
  return { firstDate: today, lastDate: addDays(today, rules.maxAdvanceDays) };
}

export type SlotDenial = "not-a-slot" | "past" | "too-soon" | "too-far";

/** Why a start instant can't be booked now (null: it can). */
export function checkSlot(
  startsAt: Date,
  rules: SpaceRules,
  now: Date,
  timeZone: string,
): SlotDenial | null {
  const date = toLocalDate(startsAt, timeZone);
  const slot = slotsOfDay(date, rules, timeZone).some(
    (item) => item.startsAt.getTime() === startsAt.getTime(),
  );
  if (!slot) return "not-a-slot";
  if (startsAt <= now) return "past";
  if (startsAt.getTime() < now.getTime() + rules.minAdvanceHours * 3_600_000) {
    return "too-soon";
  }
  const { lastDate } = bookingWindow(rules, now, timeZone);
  if (daysBetween(date, lastDate) < 0) return "too-far";
  return null;
}

/**
 * The period a booking counts in for the unit limit: its day, its week
 * (Monday to Sunday) or its month.
 */
export function limitRange(
  startsAt: Date,
  period: LimitPeriod,
  timeZone: string,
): { from: Date; to: Date } {
  const date = toLocalDate(startsAt, timeZone);
  let first = date;
  let next = addDays(date, 1);
  if (period === LimitPeriod.WEEK) {
    const sinceMonday = (weekdayOf(date) + 6) % 7;
    first = addDays(date, -sinceMonday);
    next = addDays(first, 7);
  } else if (period === LimitPeriod.MONTH) {
    first = `${date.slice(0, 7)}-01`;
    const [year, month] = date.split("-").map(Number) as [number, number];
    next =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  }
  return {
    from: startOfLocalDate(first, timeZone),
    to: startOfLocalDate(next, timeZone),
  };
}
