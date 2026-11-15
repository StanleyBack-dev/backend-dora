import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { GuestBookingService } from "@/modules/bookings/application/guest-booking.service";
import {
  BOOKING_GUEST_REPOSITORY,
  type BookingGuestRepositoryPort,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import type { BookingGuest } from "@/modules/bookings/domain/booking-guest";

// The guest list of a booking (the booker's own, or any for a manager).
@Injectable()
export class ListBookingGuestsUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    private readonly bookings: GuestBookingService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    bookingId: string,
  ): Promise<BookingGuest[]> {
    const { booking } = await this.bookings.load(actor, bookingId, {
      toChange: false,
    });
    return this.guests.listForBooking(booking.id);
  }
}
