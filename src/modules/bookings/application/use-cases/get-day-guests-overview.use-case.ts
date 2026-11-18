import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { guestDay } from "@/modules/bookings/application/guest-day";
import {
  BOOKING_GUEST_REPOSITORY,
  type BookingGuestRepositoryPort,
  type DayGuestsOverview,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// A day's guests at a glance for the managers: the numbers (whatever the
// filters) and what the filters offer.
@Injectable()
export class GetDayGuestsOverviewUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute(
    actor: AuthenticatedUser,
    date: string | null,
  ): Promise<DayGuestsOverview> {
    return this.guests.overviewOfDay(
      tenantOf(actor),
      guestDay(this.clock, date),
    );
  }
}
