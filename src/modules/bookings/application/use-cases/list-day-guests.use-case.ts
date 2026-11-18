import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { guestDay } from "@/modules/bookings/application/guest-day";
import {
  BOOKING_GUEST_REPOSITORY,
  type BookingGuestRepositoryPort,
  type DayGuestFilter,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import {
  toGateEntry,
  type GateEntry,
} from "@/modules/bookings/application/use-cases/list-gate-guests.use-case";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

// A day's guests for the managers (Gestão, Reservas, Convidados): a page
// of the guests of the day's active bookings that match the filter, by
// start time, with who invited and whether they came in.
@Injectable()
export class ListDayGuestsUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    date: string | null,
    filter: DayGuestFilter,
    page: PageRequest,
  ): Promise<Paginated<GateEntry>> {
    const now = this.clock.now();
    const result = await this.guests.forDay(
      tenantOf(actor),
      guestDay(this.clock, date),
      filter,
      page,
    );
    return {
      ...result,
      items: result.items.map((guest) => toGateEntry(guest, now)),
    };
  }
}
