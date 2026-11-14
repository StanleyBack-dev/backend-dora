import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { BookingAccessService } from "@/modules/bookings/application/booking-access.service";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  SPACE_BLOCK_REPOSITORY,
  type SpaceBlockRepositoryPort,
} from "@/modules/bookings/application/ports/space-block-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import type { BookingStatus } from "@/modules/bookings/domain/booking";
import {
  bookingWindow,
  checkSlot,
  slotsOfDay,
} from "@/modules/bookings/domain/booking-slots";
import { overlaps } from "@/modules/bookings/domain/space-block";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { isLocalDate } from "@/shared/domain/local-date";

export enum SlotState {
  FREE = "FREE",
  /** The caller's own booking. */
  MINE = "MINE",
  /** Someone else's booking. */
  TAKEN = "TAKEN",
  BLOCKED = "BLOCKED",
  /** Past, too soon or beyond the booking window. */
  UNAVAILABLE = "UNAVAILABLE",
}

export type SlotView = {
  startsAt: Date;
  endsAt: Date;
  state: SlotState;
  /** The booking in the slot (only the caller's own, or for managers). */
  bookingId: string | null;
  bookingStatus: BookingStatus | null;
  /** Who holds it (managers) or why it is blocked (everyone). */
  label: string | null;
};

export type Availability = {
  spaceId: string;
  date: string;
  /** The dates residents can book (today … today + window). */
  firstDate: string;
  lastDate: string;
  slots: SlotView[];
};

// The slot grid of one day: what is free, taken, blocked or out of reach.
// Residents only learn that a slot is taken; managers see by whom.
@Injectable()
export class GetSpaceAvailabilityUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(SPACE_BLOCK_REPOSITORY)
    private readonly blocks: SpaceBlockRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly spaces: SpaceForBooking,
    private readonly access: BookingAccessService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    spaceId: string,
    date: string,
  ): Promise<Availability> {
    if (!isLocalDate(date)) {
      throw AppException.from(APP_ERRORS.bookings.invalidText, {
        reason: "Data inválida.",
      });
    }
    const manager = await this.access.canManage(actor);
    const space = await this.spaces.load(actor, spaceId, manager);
    const now = this.clock.now();
    const timeZone = this.clock.timeZone;
    const window = bookingWindow(space.rules, now, timeZone);
    const slots = slotsOfDay(date, space.rules, timeZone);
    if (slots.length === 0) {
      return { spaceId, date, ...window, slots: [] };
    }

    const from = slots[0]!.startsAt;
    const to = slots[slots.length - 1]!.endsAt;
    const [bookings, blocks] = await Promise.all([
      this.bookings.activeInRange(space.id, from, to),
      this.blocks.overlapping(space.id, from, to),
    ]);

    return {
      spaceId,
      date,
      ...window,
      slots: slots.map((slot): SlotView => {
        const booking = bookings.find((item) => overlaps(item, slot));
        if (booking) {
          const mine = booking.userId === actor.id;
          const holder =
            booking.unitNumber !== null
              ? `${unitLabel({ block: booking.unitBlock ?? "", number: booking.unitNumber })} · ${booking.userName}`
              : booking.userName;
          return {
            ...slot,
            state: mine ? SlotState.MINE : SlotState.TAKEN,
            bookingId: mine || manager ? booking.id : null,
            bookingStatus: mine || manager ? booking.status : null,
            label: manager ? holder : null,
          };
        }
        const block = blocks.find((item) => overlaps(item, slot));
        if (block) {
          return {
            ...slot,
            state: SlotState.BLOCKED,
            bookingId: null,
            bookingStatus: null,
            label: block.reason,
          };
        }
        const denial = checkSlot(slot.startsAt, space.rules, now, timeZone);
        return {
          ...slot,
          state: denial ? SlotState.UNAVAILABLE : SlotState.FREE,
          bookingId: null,
          bookingStatus: null,
          label: null,
        };
      }),
    };
  }
}
