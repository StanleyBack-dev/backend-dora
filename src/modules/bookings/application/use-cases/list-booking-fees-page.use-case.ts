import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { feesMonth } from "@/modules/bookings/application/fees-month";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
  type BookingView,
  type FeeFilter,
} from "@/modules/bookings/application/ports/booking-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

// A page of a month's usage fees for the managers (Gestão, Reservas,
// Taxas de uso), filtered by the API, by unit and then start.
@Injectable()
export class ListBookingFeesPageUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute(
    actor: AuthenticatedUser,
    month: string | null,
    filter: FeeFilter,
    page: PageRequest,
  ): Promise<Paginated<BookingView>> {
    const period = feesMonth(this.clock, month);
    return this.bookings.feesPageInRange(
      tenantOf(actor),
      period.from,
      period.to,
      filter,
      page,
    );
  }
}
