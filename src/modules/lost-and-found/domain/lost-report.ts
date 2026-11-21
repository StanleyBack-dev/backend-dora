// "Perdi algo": a resident says what they lost. When the desk registers an
// item of the same category, they are told it may be theirs.

export enum LostReportStatus {
  /** Still looking. */
  OPEN = "OPEN",
  /** They got it back (said so, or the desk handed it over). */
  FOUND = "FOUND",
  /** They stopped looking. */
  CANCELLED = "CANCELLED",
  /** No news within the keeping period. */
  EXPIRED = "EXPIRED",
}

/** An open report ends on its own after this long. */
export const LOST_REPORT_KEEP_DAYS = 90;

/** Limits of the free-text fields (characters). */
export const LOST_REPORT_TEXT_LIMITS = {
  title: 80,
  description: 300,
  lostLocation: 80,
} as const;

export type LostReportTextField = keyof typeof LOST_REPORT_TEXT_LIMITS;
