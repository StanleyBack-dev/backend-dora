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

/** Filters of an event's tickets (null: any). */
export type EventTicketFilter = {
  /** Name, buyer, unit or a code (ticket or order). */
  search: string | null;
  checkedIn: boolean | null;
  ticketName: string | null;
  outside: boolean | null;
  /** true: who ordered; false: who came in someone's order. */
  buyer: boolean | null;
};

export const NO_TICKET_FILTER: EventTicketFilter = {
  search: null,
  checkedIn: null,
  ticketName: null,
  outside: null,
  buyer: null,
};

export const EVENT_TICKET_REPOSITORY = Symbol("EVENT_TICKET_REPOSITORY");

export interface EventTicketRepositoryPort {
  /**
   * The tickets of the confirmed orders of the condominium's events that
   * happen in [from, to) (published or cancelled), by start time.
   */
  forGate(condominiumId: string, from: Date, to: Date): Promise<EventTicket[]>;
  /**
   * The tickets of one event's confirmed orders that match the filter, by
   * order and position.
   */
  forEvent(
    condominiumId: string,
    eventId: string,
    filter: EventTicketFilter,
  ): Promise<EventTicket[]>;
  /** Only a ticket of this condominium. */
  find(condominiumId: string, attendeeId: string): Promise<EventTicket | null>;
  /** Any condominium's (the caller checks it). */
  findByCode(code: string): Promise<EventTicket | null>;
  /** Records the entry (or clears it: `at` null). */
  setCheckIn(attendeeId: string, at: Date | null, by: string): Promise<void>;
}
