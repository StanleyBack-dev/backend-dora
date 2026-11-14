import type { Booking, BookingStatus } from "@/modules/bookings/domain/booking";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** A booking with the names the screens show. */
export type BookingView = Booking & {
  spaceName: string;
  spaceKind: string;
  userName: string;
  unitBlock: string | null;
  unitNumber: string | null;
};

export type NewBooking = Pick<
  Booking,
  | "condominiumId"
  | "spaceId"
  | "userId"
  | "unitId"
  | "startsAt"
  | "endsAt"
  | "status"
  | "notes"
  | "cancelUntil"
>;

export type BookingPatch = Partial<
  Pick<
    Booking,
    | "status"
    | "decidedBy"
    | "decidedAt"
    | "reason"
    | "cancelledBy"
    | "cancelledAt"
  >
>;

export type BookingFilter = {
  condominiumId: string;
  spaceId?: string;
  userId?: string;
  status?: BookingStatus;
  /** Upcoming: not ended yet (soonest first); past: ended (latest first). */
  when?: "UPCOMING" | "PAST";
  /** Starts on or after / before these instants. */
  from?: Date;
  to?: Date;
};

/** Another active booking holds the slot (the exclusion constraint fired). */
export class SlotTakenError extends Error {
  constructor() {
    super("slot taken");
  }
}

export interface BookingRepositoryPort {
  /**
   * Stores the booking and its notices in one transaction. Throws
   * SlotTakenError when an active booking already holds the period.
   */
  create(
    data: NewBooking,
    notices: (booking: Booking) => OutboxDraft[],
  ): Promise<BookingView>;
  /** Only when it belongs to the condominium. */
  find(condominiumId: string, id: string): Promise<BookingView | null>;
  /** Changes the booking and stores its notices in one transaction. */
  update(
    id: string,
    patch: BookingPatch,
    notices: OutboxDraft[],
  ): Promise<BookingView>;
  /** Active bookings of a space that overlap [from, to). */
  activeInRange(spaceId: string, from: Date, to: Date): Promise<BookingView[]>;
  /** Active bookings of a unit in a space starting in [from, to). */
  countUnitActive(
    spaceId: string,
    unitId: string,
    from: Date,
    to: Date,
  ): Promise<number>;
  page(
    filter: BookingFilter,
    page: PageRequest,
  ): Promise<Paginated<BookingView>>;
}

export const BOOKING_REPOSITORY = Symbol("BOOKING_REPOSITORY");
