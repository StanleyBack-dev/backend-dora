import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
} from "@/modules/bookings/application/ports/booking-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/** Most bookings marked in one go (a month of a large condominium). */
export const MAX_FEES_PER_REQUEST = 500;

// Marks usage fees as sent to the condominium's billing, or undoes it.
// Only confirmed bookings with a fee of the session's condominium change.
@Injectable()
export class SetBookingFeesBilledUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute(
    actor: AuthenticatedUser,
    bookingIds: readonly string[],
    billed: boolean,
  ): Promise<number> {
    return this.bookings.setFeesBilled(
      tenantOf(actor),
      [...new Set(bookingIds)].slice(0, MAX_FEES_PER_REQUEST),
      billed ? this.clock.now() : null,
      actor.id,
    );
  }
}
