/** Periods the landing panel offers (days, today included). */
export const LANDING_PERIOD_DAYS = [7, 30, 90, 365] as const;
export const DEFAULT_LANDING_PERIOD_DAYS = 30;

/** Any asked period snaps to an offered one (default: 30 days). */
export function resolveLandingDays(days: number | null | undefined): number {
  return LANDING_PERIOD_DAYS.includes(days as never)
    ? (days as number)
    : DEFAULT_LANDING_PERIOD_DAYS;
}

const DAY_MS = 86_400_000;

/** First calendar day (YYYY-MM-DD) of a period of `days` ending `today`. */
export function periodFirstDay(today: string, days: number): string {
  const start = Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY_MS;
  return new Date(start).toISOString().slice(0, 10);
}
