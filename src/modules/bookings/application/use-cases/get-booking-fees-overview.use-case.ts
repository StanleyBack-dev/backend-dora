import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { feesMonth } from "@/modules/bookings/application/fees-month";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
  type FeesOverview,
} from "@/modules/bookings/application/ports/booking-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// A month's usage fees at a glance for the managers: the numbers (whatever
// the filters) and what the filters offer.
@Injectable()
export class GetBookingFeesOverviewUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    month: string | null,
  ): Promise<FeesOverview & { month: string }> {
    const period = feesMonth(this.clock, month);
    return {
      month: period.month,
      ...(await this.bookings.feesOverviewInRange(
        tenantOf(actor),
        period.from,
        period.to,
      )),
    };
  }
}
