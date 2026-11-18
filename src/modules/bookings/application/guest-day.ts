import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type { GuestPeriod } from "@/modules/bookings/application/ports/booking-guest-repository.port";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import { addDays, isLocalDate } from "@/shared/domain/local-date";

/**
 * The period of a day's guest lists (gate and managers): the whole local
 * day asked for ("YYYY-MM-DD"), today by default.
 */
export function guestDay(
  clock: ClockPort,
  date: string | null | undefined,
): GuestPeriod {
  const day = date ?? clock.localDate(clock.now());
  if (!isLocalDate(day)) {
    throw AppException.from(APP_ERRORS.bookings.invalidText, {
      reason: "Data inválida.",
    });
  }
  return {
    from: clock.startOfLocalDate(day),
    to: clock.startOfLocalDate(addDays(day, 1)),
  };
}
