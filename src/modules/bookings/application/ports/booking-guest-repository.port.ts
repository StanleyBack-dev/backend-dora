import type { BookingStatus } from "@/modules/bookings/domain/booking";
import type {
  BookingGuest,
  GuestData,
} from "@/modules/bookings/domain/booking-guest";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** A guest with the booking the gate needs to see. */
export type GateGuest = BookingGuest & {
  spaceName: string;
  startsAt: Date;
  endsAt: Date;
  bookingStatus: BookingStatus;
  bookingUserId: string;
  hostName: string;
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
};

/** What a guest's invite shows (public page, by code). */
export type GuestInviteView = GateGuest & { condominiumName: string };

export type NewGuest = GuestData & { code: string };

/** A period of the gate's lists: [from, to). */
export type GuestPeriod = { from: Date; to: Date };

/** What narrows a day's guests for the managers (null: any). */
export type DayGuestFilter = {
  guestId: string | null;
  /** Who booked (who invited). */
  hostId: string | null;
  unitId: string | null;
  spaceId: string | null;
  /** true: only who came in; false: only who didn't yet. */
  checkedIn: boolean | null;
};

export const NO_DAY_GUEST_FILTER: DayGuestFilter = {
  guestId: null,
  hostId: null,
  unitId: null,
  spaceId: null,
  checkedIn: null,
};

/** Something to pick in a filter. */
export type GuestFilterOption = { id: string; label: string };

/**
 * A day's guests at a glance, whatever the filters: the numbers and what
 * the filters offer.
 */
export type DayGuestsOverview = {
  total: number;
  checkedIn: number;
  bookings: number;
  guests: GuestFilterOption[];
  hosts: GuestFilterOption[];
  units: GuestFilterOption[];
  spaces: GuestFilterOption[];
};

/** Another guest already has the generated code (try another). */
export class GuestCodeTakenError extends Error {
  constructor() {
    super("guest code taken");
  }
}

export interface BookingGuestRepositoryPort {
  /** In the order they were added. */
  listForBooking(bookingId: string): Promise<BookingGuest[]>;
  countForBooking(bookingId: string): Promise<number>;
  /** All or nothing; GuestCodeTakenError on a (rare) code collision. */
  add(
    booking: { id: string; condominiumId: string },
    guests: NewGuest[],
    actorId: string,
  ): Promise<BookingGuest[]>;
  /** Only when it belongs to the condominium. */
  find(condominiumId: string, id: string): Promise<GateGuest | null>;
  findByCode(code: string): Promise<GuestInviteView | null>;
  remove(id: string): Promise<void>;
  /**
   * Guests of active bookings of the condominium that overlap [from, to),
   * by start then name.
   */
  forGate(condominiumId: string, from: Date, to: Date): Promise<GateGuest[]>;
  /** A page of the same guests that match the filter, in the same order. */
  forDay(
    condominiumId: string,
    period: GuestPeriod,
    filter: DayGuestFilter,
    page: PageRequest,
  ): Promise<Paginated<GateGuest>>;
  /** The numbers and the filter options of the same guests. */
  overviewOfDay(
    condominiumId: string,
    period: GuestPeriod,
  ): Promise<DayGuestsOverview>;
  /** `at` null: undoes the check-in. `actorId`: who did it, either way. */
  setCheckIn(id: string, at: Date | null, actorId: string): Promise<void>;
}

export const BOOKING_GUEST_REPOSITORY = Symbol("BOOKING_GUEST_REPOSITORY");
