import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import { isMonth, monthDates } from "@/modules/bookings/domain/booking-fee";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type BookingFees = {
  /** YYYY-MM. */
  month: string;
  items: BookingView[];
  totalCents: number;
  billedCents: number;
};

// The usage fees of a month for the condominium's billing: confirmed
// bookings of paid spaces, by unit, with what was already sent.
@Injectable()
export class ListBookingFeesUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    month?: string | null,
  ): Promise<BookingFees> {
    const chosen = month ?? this.clock.localDate().slice(0, 7);
    if (!isMonth(chosen)) {
      throw AppException.from(APP_ERRORS.bookings.invalidMonth, undefined);
    }
    const { first, next } = monthDates(chosen);
    const items = await this.bookings.feesInRange(
      tenantOf(actor),
      this.clock.startOfLocalDate(first),
      this.clock.startOfLocalDate(next),
    );
    const sum = (rows: BookingView[]) =>
      rows.reduce((total, row) => total + (row.feeCents ?? 0), 0);
    return {
      month: chosen,
      items,
      totalCents: sum(items),
      billedCents: sum(items.filter((row) => row.feeBilledAt !== null)),
    };
  }
}
