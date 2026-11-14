/** How the series groups the period. */
export enum MetricsGranularity {
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
}

/** Calendar days (app timezone), both ends included. */
export type MetricsPeriod = {
  from: string;
  to: string;
  /** Number of days, both ends included. */
  days: number;
  granularity: MetricsGranularity;
};

/** Longest period the panel reads at once. */
export const MAX_PERIOD_DAYS = 366;
/** Period used when none is asked: the last 30 days, today included. */
export const DEFAULT_PERIOD_DAYS = 30;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A real calendar date (rejects 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const ms = toUtc(value);
  return !Number.isNaN(ms) && fromUtc(ms) === value;
}

/** Day buckets for short periods, weeks up to ~4 months, then months. */
export function granularityFor(days: number): MetricsGranularity {
  if (days <= 31) return MetricsGranularity.DAY;
  if (days <= 120) return MetricsGranularity.WEEK;
  return MetricsGranularity.MONTH;
}

/**
 * The period to read: both dates, or the last 30 days ending today. Returns
 * null when a date is invalid, the order is reversed, it ends after today or
 * it is longer than a year.
 */
export function resolvePeriod(
  input: { from?: string | null; to?: string | null },
  today: string,
): MetricsPeriod | null {
  const to = input.to ?? today;
  const from =
    input.from ?? fromUtc(toUtc(to) - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS);
  if (!isCalendarDate(from) || !isCalendarDate(to)) return null;
  if (to > today || from > to) return null;
  const days = (toUtc(to) - toUtc(from)) / DAY_MS + 1;
  if (days > MAX_PERIOD_DAYS) return null;
  return { from, to, days, granularity: granularityFor(days) };
}

/** The day after a calendar date (exclusive end of a period). */
export const nextDate = (date: string): string => fromUtc(toUtc(date) + DAY_MS);
