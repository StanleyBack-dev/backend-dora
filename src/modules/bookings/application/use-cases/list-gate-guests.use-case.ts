import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  BOOKING_GUEST_REPOSITORY,
  type BookingGuestRepositoryPort,
  type GateGuest,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import { isActive } from "@/modules/bookings/domain/booking";
import {
  checkInDenial,
  type CheckInDenial,
} from "@/modules/bookings/domain/booking-guest";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { addDays, isLocalDate } from "@/shared/domain/local-date";

/** A guest on the gate's list, with whether they can come in now. */
export type GateEntry = GateGuest & { checkInDenial: CheckInDenial | null };

// The gate's list (Portaria): guests of the active bookings of a day
// (today by default), by start time. The gate sees what it needs to let
// people in: names, documents, the booking and its unit.
@Injectable()
export class ListGateGuestsUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    date?: string | null,
  ): Promise<GateEntry[]> {
    const now = this.clock.now();
    const day = date ?? this.clock.localDate(now);
    if (!isLocalDate(day)) {
      throw AppException.from(APP_ERRORS.bookings.invalidText, {
        reason: "Data inválida.",
      });
    }
    const rows = await this.guests.forGate(
      tenantOf(actor),
      this.clock.startOfLocalDate(day),
      this.clock.startOfLocalDate(addDays(day, 1)),
    );
    return rows.map((guest) => ({
      ...guest,
      checkInDenial: checkInDenial(
        {
          startsAt: guest.startsAt,
          endsAt: guest.endsAt,
          active: isActive(guest.bookingStatus),
        },
        now,
      ),
    }));
  }
}
