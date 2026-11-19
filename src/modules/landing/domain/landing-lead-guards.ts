import type { RateRule } from "@/shared/domain/rate-limit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Anti-spam rules of the public contact form. Counters live in the shared
// rate-limit store (database), keyed by digests: no IP or e-mail is stored
// in them.
export const LEAD_GUARDS = {
  /** Messages one (hashed) IP may send. */
  perIp: { limit: 5, windowMs: HOUR } satisfies RateRule,
  /** Messages one e-mail address may send, from any IP. */
  perEmail: { limit: 3, windowMs: DAY } satisfies RateRule,
  /** The same message from the same e-mail within this window is a resend. */
  duplicateWindowMs: HOUR,
  /**
   * Confirmations one recipient may get: the form accepts any address, so
   * without this it could be used to flood someone else's inbox.
   */
  confirmationPerRecipient: { limit: 1, windowMs: DAY } satisfies RateRule,
  /**
   * Circuit breaker: e-mails the form may send per hour in total (default;
   * LANDING_LEADS_MAIL_HOURLY_LIMIT). Above it leads are still stored, but
   * held without e-mail, so a flood never drains the Brevo quota the app's
   * own e-mails (password recovery, invites) depend on.
   */
  defaultMailsPerHour: 50,
  mailWindowMs: HOUR,
} as const;

/** What happened to a submitted lead. */
export enum LeadOutcome {
  /** Stored and e-mailed to the Dora inbox. */
  SENT = "SENT",
  /** Stored; the inbox e-mail failed (see mail_status). */
  STORED = "STORED",
  /** Stored without e-mail: the hourly e-mail limit was reached. */
  HELD = "HELD",
  /** A resend of a message just received: nothing new stored or sent. */
  DUPLICATE = "DUPLICATE",
}
