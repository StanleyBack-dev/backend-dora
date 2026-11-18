import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { isMonth, monthDates } from "@/modules/bookings/domain/booking-fee";
import type { ClockPort } from "@/shared/application/ports/clock.port";

/**
 * The month of the usage fees ("YYYY-MM", the current one by default) and
 * its period: [first day, first day of the next month).
 */
export function feesMonth(
  clock: ClockPort,
  month: string | null | undefined,
): { month: string; from: Date; to: Date } {
  const chosen = month ?? clock.localDate().slice(0, 7);
  if (!isMonth(chosen)) {
    throw AppException.from(APP_ERRORS.bookings.invalidMonth, undefined);
  }
  const { first, next } = monthDates(chosen);
  return {
    month: chosen,
    from: clock.startOfLocalDate(first),
    to: clock.startOfLocalDate(next),
  };
}
