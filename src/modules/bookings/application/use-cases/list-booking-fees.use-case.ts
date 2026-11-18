import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { feesMonth } from "@/modules/bookings/application/fees-month";
import {
  BOOKING_REPOSITORY,
  NO_FEE_FILTER,
  type BookingRepositoryPort,
  type BookingView,
  type FeeFilter,
} from "@/modules/bookings/application/ports/booking-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type BookingFees = {
  /** YYYY-MM. */
  month: string;
  items: BookingView[];
  totalCents: number;
  billedCents: number;
};

// The usage fees of a month for the condominium's billing: confirmed
// bookings of paid spaces, by unit, with what was already sent. Every fee
// that matches the filter (the spreadsheet exports them all).
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
    filter: FeeFilter = NO_FEE_FILTER,
  ): Promise<BookingFees> {
    const period = feesMonth(this.clock, month);
    const items = await this.bookings.feesInRange(
      tenantOf(actor),
      period.from,
      period.to,
      filter,
    );
    const sum = (rows: BookingView[]) =>
      rows.reduce((total, row) => total + (row.feeCents ?? 0), 0);
    return {
      month: period.month,
      items,
      totalCents: sum(items),
      billedCents: sum(items.filter((row) => row.feeBilledAt !== null)),
    };
  }
}
