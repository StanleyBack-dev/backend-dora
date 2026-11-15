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
import type { GateEntry } from "@/modules/bookings/application/use-cases/list-gate-guests.use-case";
import { isActive } from "@/modules/bookings/domain/booking";
import {
  checkInDenial,
  normalizeGuestCode,
  type CheckInDenial,
} from "@/modules/bookings/domain/booking-guest";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { formatTime } from "@/shared/domain/local-date";

export type CheckInTarget = { guestId?: string | null; code?: string | null };

// The gate lets a guest in, by the code on the invite (typed or scanned) or
// from the day's list, from 3 hours before the booking until it ends. A
// check-in can be undone (wrong person tapped).
@Injectable()
export class CheckInGuestUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    target: CheckInTarget,
    undo = false,
  ): Promise<GateEntry> {
    const guest = await this.load(tenantOf(actor), target);
    const now = this.clock.now();
    const booking = {
      startsAt: guest.startsAt,
      endsAt: guest.endsAt,
      active: isActive(guest.bookingStatus),
    };
    if (!undo) {
      const denial = checkInDenial(booking, now);
      if (denial) {
        throw AppException.from(APP_ERRORS.bookings.checkInDenied, {
          reason: this.message(denial, guest),
        });
      }
    }
    if (undo || !guest.checkedInAt) {
      await this.guests.setCheckIn(guest.id, undo ? null : now, actor.id);
    }
    const updated = await this.load(tenantOf(actor), { guestId: guest.id });
    return { ...updated, checkInDenial: checkInDenial(booking, now) };
  }

  private async load(
    condominiumId: string,
    target: CheckInTarget,
  ): Promise<GateGuest> {
    let guest: GateGuest | null = null;
    if (target.guestId) {
      guest = await this.guests.find(condominiumId, target.guestId);
    } else if (target.code) {
      const code = normalizeGuestCode(target.code);
      const found = code ? await this.guests.findByCode(code) : null;
      // Another condominium's invite is "not found" here.
      guest = found?.condominiumId === condominiumId ? found : null;
    }
    if (!guest) {
      throw AppException.from(APP_ERRORS.bookings.guestNotFound, undefined);
    }
    return guest;
  }

  private message(denial: CheckInDenial, guest: GateGuest): string {
    if (denial === "not-active") {
      return "A reserva deste convidado foi cancelada.";
    }
    if (denial === "finished") return "A reserva deste convidado já terminou.";
    const opens = new Date(guest.startsAt.getTime() - 3 * 3_600_000);
    return `Ainda é cedo: a entrada dos convidados abre às ${formatTime(opens, this.clock.timeZone)}.`;
  }
}
