import { Inject, Injectable } from "@nestjs/common";
import { slotFreedNotice } from "@/modules/bookings/application/booking-notices";
import type { BookingView } from "@/modules/bookings/application/ports/booking-repository.port";
import {
  WAITLIST_REPOSITORY,
  type WaitlistRepositoryPort,
} from "@/modules/bookings/application/ports/waitlist-repository.port";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// When a booking stops holding its slot (cancelled or rejected), everyone on
// that slot's waiting list is told at once, in the order they joined; the
// first to book gets it. Past slots notify nobody.
@Injectable()
export class FreedSlotNoticesService {
  constructor(
    @Inject(WAITLIST_REPOSITORY)
    private readonly waitlist: WaitlistRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async for(booking: BookingView): Promise<OutboxDraft[]> {
    if (booking.startsAt <= this.clock.now()) return [];
    const waiting = await this.waitlist.waiting(
      booking.spaceId,
      booking.startsAt,
    );
    return waiting
      .filter((userId) => userId !== booking.userId)
      .map((userId) => slotFreedNotice(userId, booking, this.clock.timeZone));
  }
}
