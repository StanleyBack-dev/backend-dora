/** How e-mails leave this instance. */
export type MailDelivery = "send" | "redirect" | "log";

/**
 * Only production e-mails real people. Anywhere else (local development,
 * tests) Brevo is never used for the real recipients: every message goes to
 * MAIL_DEV_REDIRECT_TO when it is set (to see the e-mails for real), or only
 * to the log. A development database may hold real addresses (a Neon branch
 * starts as a copy of its parent), so this can't depend on who signs up.
 */
export function mailDeliveryFor(settings: {
  nodeEnv: string | undefined;
  driver: string | undefined;
  redirectTo: string | undefined;
}): MailDelivery {
  if (settings.driver !== "brevo") return "log";
  if (settings.nodeEnv === "production") return "send";
  return settings.redirectTo?.trim() ? "redirect" : "log";
}
