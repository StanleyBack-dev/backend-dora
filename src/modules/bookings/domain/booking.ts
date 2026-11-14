// A resident's booking of a space for one slot.

export enum BookingStatus {
  /** Waiting for a manager (spaces that require approval). */
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

/** Statuses that hold the slot (the database forbids two overlapping). */
export const ACTIVE_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

export const isActive = (status: BookingStatus): boolean =>
  ACTIVE_STATUSES.includes(status);

export type Booking = {
  id: string;
  condominiumId: string;
  spaceId: string;
  /** Who booked. */
  userId: string;
  /** The unit it counts for (null: a manager's booking without a unit). */
  unitId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  notes: string | null;
  /**
   * Last moment the booker can cancel, fixed when booking (later rule
   * changes don't move it).
   */
  cancelUntil: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
  /** Why a manager rejected or cancelled it. */
  reason: string | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

/** Trimmed free text, null when empty; "too-long" past the limit. */
export function normalizeText(
  value: string | null | undefined,
  max: number,
): string | null | "too-long" {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (text === "") return null;
  return text.length > max ? "too-long" : text;
}

export type CancelDenial = "not-active" | "finished" | "deadline";

/**
 * Whether a booking can still be cancelled. The booker until the deadline
 * fixed when booking; a manager while the booking has not ended.
 */
export function checkCancel(
  booking: Pick<Booking, "status" | "endsAt" | "cancelUntil">,
  now: Date,
  byManager: boolean,
): CancelDenial | null {
  if (!isActive(booking.status)) return "not-active";
  if (booking.endsAt <= now) return "finished";
  if (!byManager && now > booking.cancelUntil) return "deadline";
  return null;
}

/** Which bookings a list shows: not ended yet, or already ended. */
export enum BookingWhen {
  UPCOMING = "UPCOMING",
  PAST = "PAST",
}
