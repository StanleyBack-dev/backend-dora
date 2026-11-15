import {
  addDays,
  startOfLocalDate,
  toLocalDate,
} from "@/shared/domain/local-date";

// A weekly series: the same slot, the same weekday, for a number of weeks.
// Each date is computed in the condominium's calendar, so the local time
// stays the same across the weeks.

/** Longest series (about six months). */
export const MAX_SERIES_WEEKS = 26;
/** A series has at least this many dates (one is a plain booking). */
export const MIN_SERIES_WEEKS = 2;

export const isSeriesLength = (weeks: number): boolean =>
  Number.isInteger(weeks) &&
  weeks >= MIN_SERIES_WEEKS &&
  weeks <= MAX_SERIES_WEEKS;

/** The start of each week's booking, the first one included. */
export function weeklyStarts(
  first: Date,
  weeks: number,
  timeZone: string,
): Date[] {
  const date = toLocalDate(first, timeZone);
  const sinceMidnight =
    first.getTime() - startOfLocalDate(date, timeZone).getTime();
  return Array.from(
    { length: weeks },
    (_, week) =>
      new Date(
        startOfLocalDate(addDays(date, week * 7), timeZone).getTime() +
          sinceMidnight,
      ),
  );
}
