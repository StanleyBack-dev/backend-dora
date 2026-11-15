import type { CheckInDenial } from "@/modules/bookings/domain/booking-guest";

/** Whether the gate can let a guest in now (the API's view of it). */
export enum GuestCheckInWindow {
  OPEN = "OPEN",
  /** More than 3 hours before the booking starts. */
  TOO_EARLY = "TOO_EARLY",
  FINISHED = "FINISHED",
  /** The booking was cancelled or rejected. */
  CANCELLED = "CANCELLED",
}

export const checkInWindowOf = (
  denial: CheckInDenial | null,
): GuestCheckInWindow => {
  if (denial === "too-early") return GuestCheckInWindow.TOO_EARLY;
  if (denial === "finished") return GuestCheckInWindow.FINISHED;
  if (denial === "not-active") return GuestCheckInWindow.CANCELLED;
  return GuestCheckInWindow.OPEN;
};
