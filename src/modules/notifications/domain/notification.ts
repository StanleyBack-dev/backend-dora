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
  /** A slot you were waiting for is free again (waiting list). */
  BOOKING_SLOT_FREED = "BOOKING_SLOT_FREED",
  /** A new event of the condominium was published. */
  EVENT_PUBLISHED = "EVENT_PUBLISHED",
  /** A published event was cancelled. */
  EVENT_CANCELLED = "EVENT_CANCELLED",
  /** For whoever reviews payments: a ticket receipt waits for review. */
  EVENT_ORDER_RECEIPT = "EVENT_ORDER_RECEIPT",
  /** Your event tickets are confirmed. */
  EVENT_ORDER_CONFIRMED = "EVENT_ORDER_CONFIRMED",
  /** Your ticket receipt was not accepted. */
  EVENT_ORDER_REJECTED = "EVENT_ORDER_REJECTED",
  /** For managers: a resident's dependent waits for approval. */
  DEPENDENT_SUBMITTED = "DEPENDENT_SUBMITTED",
  /** Your dependent was approved. */
  DEPENDENT_APPROVED = "DEPENDENT_APPROVED",
  /** Your dependent was not approved (with the reason). */
  DEPENDENT_REJECTED = "DEPENDENT_REJECTED",
  /** A parcel for your unit arrived at the gate (with the pickup code). */
  PARCEL_RECEIVED = "PARCEL_RECEIVED",
  /** A parcel for your unit is still waiting at the gate. */
  PARCEL_REMINDER = "PARCEL_REMINDER",
  /** A parcel for your unit was picked up (who signed). */
  PARCEL_PICKED_UP = "PARCEL_PICKED_UP",
  /** A parcel for your unit was sent back to the sender. */
  PARCEL_RETURNED = "PARCEL_RETURNED",
  /** A parcel registered for your unit by mistake was cancelled. */
  PARCEL_CANCELLED = "PARCEL_CANCELLED",
  /** Someone authorized another person to pick up a parcel you see. */
  PARCEL_AUTHORIZED = "PARCEL_AUTHORIZED",
  /** Staff: a resident says a found item is theirs. */
  FOUND_ITEM_CLAIMED = "FOUND_ITEM_CLAIMED",
  /** Your claim was accepted: come and take it (or rejected, with why). */
  FOUND_ITEM_CLAIM_DECIDED = "FOUND_ITEM_CLAIM_DECIDED",
  /** The item you claimed was handed over (to you, with the receipt). */
  FOUND_ITEM_RETURNED = "FOUND_ITEM_RETURNED",
  /** Staff: a found item's keeping period is about to end. */
  FOUND_ITEM_EXPIRING = "FOUND_ITEM_EXPIRING",
  /** The desk registered an item it knows is the resident's (or the unit's). */
  FOUND_ITEM_FOR_YOU = "FOUND_ITEM_FOR_YOU",
  /** To the staff: whoever an item was reserved for says it is not theirs. */
  FOUND_ITEM_NOT_OWNER = "FOUND_ITEM_NOT_OWNER",
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
