import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { BookingPolicyService } from "@/modules/bookings/application/booking-policy.service";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  WAITLIST_REPOSITORY,
  type WaitlistRepositoryPort,
} from "@/modules/bookings/application/ports/waitlist-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import { checkSlot } from "@/modules/bookings/domain/booking-slots";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// Waits for a slot someone else holds: when it is freed (cancelled or
// rejected), everyone waiting is told and the first to book gets it.
@Injectable()
export class JoinWaitlistUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(WAITLIST_REPOSITORY)
    private readonly waitlist: WaitlistRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly spaces: SpaceForBooking,
    private readonly policy: BookingPolicyService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    spaceId: string,
    startsAt: Date,
  ): Promise<void> {
    const space = await this.spaces.load(actor, spaceId);
    // Only someone who could book it waits for it (unit required).
    const booker = await this.policy.booker(actor);
    const denial = checkSlot(
      startsAt,
      space.rules,
      this.clock.now(),
      this.clock.timeZone,
    );
    if (denial === "not-a-slot") {
      throw AppException.from(APP_ERRORS.bookings.notASlot, undefined);
    }
    if (denial === "past") {
      throw AppException.from(APP_ERRORS.bookings.past, undefined);
    }
    const endsAt = new Date(
      startsAt.getTime() + space.rules.slotMinutes * 60_000,
    );
    const holders = await this.bookings.activeInRange(
      space.id,
      startsAt,
      endsAt,
    );
    if (!holders.some((booking) => booking.userId !== actor.id)) {
      throw AppException.from(APP_ERRORS.bookings.waitlistNotTaken, undefined);
    }
    await this.waitlist.join({
      condominiumId: booker.condominiumId,
      spaceId: space.id,
      userId: actor.id,
      startsAt,
    });
  }
}
