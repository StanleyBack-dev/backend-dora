import type { EventStatus } from "@/modules/events/domain/event";
import type {
  AttendeeSource,
  EventOrderStatus,
} from "@/modules/events/domain/event-order";

/** A person's ticket as the gate (and its public page) sees it. */
export type EventTicket = {
  /** The attendee. */
  id: string;
  condominiumId: string;
  condominiumName: string;
  eventId: string;
  eventTitle: string;
  eventStatus: EventStatus;
  startsAt: Date;
  endsAt: Date;
  /** The space's name, or the place outside the condominium. */
  placeName: string;
  orderId: string;
  orderCode: string;
  orderStatus: EventOrderStatus;
  /** Who ordered (null: the account was deleted). */
  buyerName: string | null;
  /** "Bloco A · 101" (null: no unit). */
  unitLabel: string | null;
  name: string;
  age: number;
  outside: boolean;
  source: AttendeeSource;
  /** The ticket type's name when ordered (null: free event). */
  ticketName: string | null;
  ticketCode: string;
  checkedInAt: Date | null;
};

export const EVENT_TICKET_REPOSITORY = Symbol("EVENT_TICKET_REPOSITORY");

export interface EventTicketRepositoryPort {
  /**
   * The tickets of the confirmed orders of the condominium's events that
   * happen in [from, to) (published or cancelled), by start time.
   */
  forGate(condominiumId: string, from: Date, to: Date): Promise<EventTicket[]>;
  /** Only a ticket of this condominium. */
  find(condominiumId: string, attendeeId: string): Promise<EventTicket | null>;
  /** Any condominium's (the caller checks it). */
  findByCode(code: string): Promise<EventTicket | null>;
  /** Records the entry (or clears it: `at` null). */
  setCheckIn(attendeeId: string, at: Date | null, by: string): Promise<void>;
}
