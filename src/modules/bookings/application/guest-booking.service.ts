import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { BookingAccessService } from "@/modules/bookings/application/booking-access.service";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import { isActive } from "@/modules/bookings/domain/booking";
import type { Space } from "@/modules/spaces/domain/space";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The booking whose guest list someone opens: the booker's own, or any for
// a manager. Changing the list needs an active booking that hasn't ended.
@Injectable()
export class GuestBookingService {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly access: BookingAccessService,
    private readonly spaces: SpaceForBooking,
  ) {}

  async load(
    actor: AuthenticatedUser,
    bookingId: string,
    options: { toChange: boolean },
  ): Promise<{ booking: BookingView; space: Space }> {
    const manager = await this.access.canManage(actor);
    const booking = await this.bookings.find(tenantOf(actor), bookingId);
    // Someone else's booking is "not found" for a resident.
    if (!booking || (!manager && booking.userId !== actor.id)) {
      throw AppException.from(APP_ERRORS.bookings.notFound, undefined);
    }
    if (
      options.toChange &&
      (!isActive(booking.status) || booking.endsAt <= this.clock.now())
    ) {
      throw AppException.from(APP_ERRORS.bookings.guestsClosed, undefined);
    }
    const space = await this.spaces.load(actor, booking.spaceId, true);
    return { booking, space };
  }
}
