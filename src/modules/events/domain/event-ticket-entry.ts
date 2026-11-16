import { EventStatus } from "@/modules/events/domain/event";
import {
  CODE_ALPHABET,
  EventOrderStatus,
} from "@/modules/events/domain/event-order";

// The ticket of each person of a confirmed order: a code the gate reads (in
// the QR, or typed) and the entry it records. 10 characters, so the gate
// tells it apart from a booking guest's invite (8) by the length alone.

export const TICKET_CODE_LENGTH = 10;

/** Entry opens this long before the event starts (like booking guests). */
export const ENTRY_OPENS_HOURS = 3;

/** A ticket code from `random(n)` (an integer in [0, n)). */
export function ticketCode(random: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < TICKET_CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  }
  return code;
}

/** A typed or scanned code, upper case without spaces or dashes; null: not one. */
export function normalizeTicketCode(value: string): string | null {
  const code = value.toUpperCase().replace(/[\s.·-]/g, "");
  const valid =
    code.length === TICKET_CODE_LENGTH &&
    [...code].every((char) => CODE_ALPHABET.includes(char));
  return valid ? code : null;
}

/** What the gate needs to know about a ticket's event and order. */
export type TicketEntryContext = {
  eventStatus: EventStatus;
  orderStatus: EventOrderStatus;
  startsAt: Date;
  endsAt: Date;
};

/** Why the gate can't let a ticket in now. */
export type EntryDenial =
  /** The order is not confirmed (or the event was cancelled). */
  | "not-valid"
  /** More than ENTRY_OPENS_HOURS before the start. */
  | "too-early"
  /** The event is over. */
  | "finished";

export function entryDenial(
  ticket: TicketEntryContext,
  now: Date,
): EntryDenial | null {
  if (
    ticket.orderStatus !== EventOrderStatus.CONFIRMED ||
    ticket.eventStatus !== EventStatus.PUBLISHED
  ) {
    return "not-valid";
  }
  if (now >= ticket.endsAt) return "finished";
  if (now.getTime() < entryOpensAt(ticket.startsAt).getTime()) {
    return "too-early";
  }
  return null;
}

export const entryOpensAt = (startsAt: Date): Date =>
  new Date(startsAt.getTime() - ENTRY_OPENS_HOURS * 3_600_000);

/** A ticket as its public page shows it. */
export enum TicketPassStatus {
  /** Show it at the gate. */
  VALID = "VALID",
  /** The event was cancelled. */
  CANCELLED = "CANCELLED",
  /** The event is over. */
  ENDED = "ENDED",
}

export function ticketPassStatus(
  ticket: Pick<TicketEntryContext, "eventStatus" | "endsAt">,
  now: Date,
): TicketPassStatus {
  if (ticket.eventStatus !== EventStatus.PUBLISHED) {
    return TicketPassStatus.CANCELLED;
  }
  return now >= ticket.endsAt ? TicketPassStatus.ENDED : TicketPassStatus.VALID;
}
