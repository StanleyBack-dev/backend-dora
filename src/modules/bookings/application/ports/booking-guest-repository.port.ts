import type { BookingStatus } from "@/modules/bookings/domain/booking";
import type {
  BookingGuest,
  GuestData,
} from "@/modules/bookings/domain/booking-guest";

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
  /** `at` null: undoes the check-in. `actorId`: who did it, either way. */
  setCheckIn(id: string, at: Date | null, actorId: string): Promise<void>;
}

export const BOOKING_GUEST_REPOSITORY = Symbol("BOOKING_GUEST_REPOSITORY");
