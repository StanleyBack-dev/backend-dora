import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { GuestBookingService } from "@/modules/bookings/application/guest-booking.service";
import {
  BOOKING_GUEST_REPOSITORY,
  type BookingGuestRepositoryPort,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";

// Takes a guest off the list (their invite stops working).
@Injectable()
export class RemoveBookingGuestUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    private readonly bookings: GuestBookingService,
  ) {}

  async execute(actor: AuthenticatedUser, guestId: string): Promise<void> {
    const guest = await this.guests.find(tenantOf(actor), guestId);
    if (!guest) {
      throw AppException.from(APP_ERRORS.bookings.guestNotFound, undefined);
    }
    // Same access as the list: the booker or a manager, booking still on.
    await this.bookings.load(actor, guest.bookingId, { toChange: true });
    await this.guests.remove(guest.id);
  }
}
