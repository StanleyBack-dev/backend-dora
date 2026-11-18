import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { guestDay } from "@/modules/bookings/application/guest-day";
import {
  BOOKING_GUEST_REPOSITORY,
  type BookingGuestRepositoryPort,
  type GateGuest,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import { isActive } from "@/modules/bookings/domain/booking";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import {
  checkInDenial,
  type CheckInDenial,
} from "@/modules/bookings/domain/booking-guest";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/** A guest on the gate's list, with whether they can come in now. */
export type GateEntry = GateGuest & { checkInDenial: CheckInDenial | null };

/** A guest with whether they can come in at `now`. */
export const toGateEntry = (guest: GateGuest, now: Date): GateEntry => ({
  ...guest,
  checkInDenial: checkInDenial(
    {
      startsAt: guest.startsAt,
      endsAt: guest.endsAt,
      active: isActive(guest.bookingStatus),
    },
    now,
  ),
});

// The gate's list (Portaria): guests of the active bookings of a day
// (today by default), by start time. The gate sees what it needs to let
// people in: names, documents, the booking and its unit. Without the
// bookings module the list is just empty: the gate also serves events.
@Injectable()
export class ListGateGuestsUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    private readonly modules: ModuleAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    date?: string | null,
  ): Promise<GateEntry[]> {
    const condominiumId = tenantOf(actor);
    if (
      !(await this.modules.enabled(condominiumId)).includes(AppModule.BOOKINGS)
    ) {
      return [];
    }
    const now = this.clock.now();
    const { from, to } = guestDay(this.clock, date);
    const rows = await this.guests.forGate(condominiumId, from, to);
    return rows.map((guest) => toGateEntry(guest, now));
  }
}
