export enum NotificationType {
  /** A manager's announcement (comunicado). */
  BROADCAST = "BROADCAST",
  /** For ADMIN_MASTER: someone asked the app's support. */
  SUPPORT_REQUESTED = "SUPPORT_REQUESTED",
  /** Your support request was answered. */
  SUPPORT_ANSWERED = "SUPPORT_ANSWERED",
  /** Your support request was closed. */
  SUPPORT_FINALIZED = "SUPPORT_FINALIZED",
  /** For ADMIN_MASTER: errors, security events, failed routines. */
  SYSTEM_ALERT = "SYSTEM_ALERT",
  /** For ADMIN_MASTER: a sign-up from the public link awaits review. */
  ENROLLMENT_SUBMITTED = "ENROLLMENT_SUBMITTED",
  /** Your booking is confirmed (straight away or after approval). */
  BOOKING_CONFIRMED = "BOOKING_CONFIRMED",
  /** For managers: a booking waits for approval. */
  BOOKING_PENDING = "BOOKING_PENDING",
  /** Your booking was rejected. */
  BOOKING_REJECTED = "BOOKING_REJECTED",
  /** A booking was cancelled (yours by a manager, or one you manage). */
  BOOKING_CANCELLED = "BOOKING_CANCELLED",
}

export const ALL_NOTIFICATION_TYPES: readonly NotificationType[] =
  Object.values(NotificationType);

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** App path, e.g. /notificacoes. */
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Every type goes by e-mail unless the user turned it off; only the
 * differences from that default are stored.
 */
export function emailEnabled(
  type: NotificationType,
  overrides: ReadonlyMap<NotificationType, boolean>,
): boolean {
  return overrides.get(type) ?? true;
}
