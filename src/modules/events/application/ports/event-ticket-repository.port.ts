import type { PageRequest, Paginated } from "@/shared/application/pagination";
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
  /** The buyer's unit (null: none). */
  unitId: string | null;
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
  /** One person (the ticket's id). */
  attendeeId: string | null;
  unitId: string | null;
  /** A ticket's code. */
  code: string | null;
  checkedIn: boolean | null;
  ticketName: string | null;
  outside: boolean | null;
  /** true: who ordered; false: who came in someone's order. */
  buyer: boolean | null;
};

export const NO_TICKET_FILTER: EventTicketFilter = {
  attendeeId: null,
  unitId: null,
  code: null,
  checkedIn: null,
  ticketName: null,
  outside: null,
  buyer: null,
};

/** A unit to pick in a filter. */
export type UnitOption = { id: string; label: string };

/**
 * An event's tickets at a glance, whatever the filters: the numbers and
 * what the filters offer (every person and unit with a ticket).
 */
export type EventTicketOverview = {
  total: number;
  checkedIn: number;
  outside: number;
  /** How many of each type (null name: free event). */
  byType: { name: string | null; count: number }[];
  people: { id: string; name: string; ticketCode: string }[];
  units: UnitOption[];
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
    page: PageRequest,
  ): Promise<Paginated<EventTicket>>;
  /** The numbers and the filter options of one event's tickets. */
  overviewOfEvent(
    condominiumId: string,
    eventId: string,
  ): Promise<EventTicketOverview>;
  /** Only a ticket of this condominium. */
  find(condominiumId: string, attendeeId: string): Promise<EventTicket | null>;
  /** Any condominium's (the caller checks it). */
  findByCode(code: string): Promise<EventTicket | null>;
  /** Records the entry (or clears it: `at` null). */
  setCheckIn(attendeeId: string, at: Date | null, by: string): Promise<void>;
}
