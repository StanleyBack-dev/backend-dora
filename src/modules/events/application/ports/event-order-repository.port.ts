import type {
  Attendee,
  EventOrderStatus,
} from "@/modules/events/domain/event-order";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PixReceiver } from "@/shared/domain/pix";

/** An order as stored, with its people and who made it. */
export type EventOrder = {
  id: string;
  condominiumId: string;
  eventId: string;
  eventTitle: string;
  /** Who ordered (null: the account was deleted). */
  userId: string | null;
  buyerName: string | null;
  unitId: string | null;
  /** "Bloco A · 101" (null: no unit). */
  unitLabel: string | null;
  /** Short code, also the PIX reference. */
  code: string;
  status: EventOrderStatus;
  totalCents: number;
  /** The PIX used (null: free order). */
  pix: PixReceiver | null;
  /** Unpaid: until when the places are held. */
  expiresAt: Date | null;
  receiptKey: string | null;
  receiptContentType: string | null;
  receiptSentAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  attendees: (Attendee & { id: string })[];
};

export type NewEventOrder = {
  condominiumId: string;
  eventId: string;
  userId: string;
  unitId: string | null;
  code: string;
  status: EventOrderStatus;
  totalCents: number;
  pix: PixReceiver | null;
  expiresAt: Date | null;
  attendees: Attendee[];
};

/** The event's limits, checked against the held places under a lock. */
export type OrderLimits = {
  capacity: number;
  externalGuestLimit: number;
  /** Per unit (or per person without a unit); null: none. */
  unitTicketLimit: number | null;
};

/**
 * Why an order didn't fit. `held`: these people (the member or their
 * dependents) already have a ticket in another active order of the event.
 */
export type OrderRefusal =
  "full" | "outside-full" | "unit-limit" | { held: string[] };

export interface EventOrderRepositoryPort {
  /**
   * Stores the order if it still fits (capacity, outside guests, unit
   * limit) and no one in it (the member, a dependent) already has a ticket
   * for the event, checked under a lock on the event so two orders can't both take
   * the last places. `notices` go to the outbox in the same transaction.
   */
  create(
    order: NewEventOrder,
    limits: OrderLimits,
    notices: OutboxDraft[],
  ): Promise<EventOrder | OrderRefusal>;
  /** Only an order of this condominium. */
  find(condominiumId: string, id: string): Promise<EventOrder | null>;
  /** The person's orders for an event, newest first. */
  listMine(userId: string, eventId: string): Promise<EventOrder[]>;
  /** An event's orders (optionally one status), oldest first. */
  listForEvent(
    eventId: string,
    status: EventOrderStatus | null,
  ): Promise<EventOrder[]>;
  /**
   * Attaches the receipt, only while the order is pending and within its
   * time (null otherwise). See `advance`.
   */
  attachReceipt(
    id: string,
    receipt: { key: string; contentType: string },
    at: Date,
  ): Promise<EventOrder | null>;
  /**
   * Attaches a person's document (only one that needs it), while the order
   * is pending and within its time (null otherwise). See `advance`.
   */
  attachProof(
    id: string,
    attendeeId: string,
    proof: { key: string; contentType: string },
    at: Date,
  ): Promise<EventOrder | null>;
  /**
   * Moves a pending order to review once nothing is missing (the receipt
   * when there is something to pay, every required document); the notices
   * go with it. Null when it didn't move.
   */
  advance(
    id: string,
    at: Date,
    notices: (order: EventOrder) => OutboxDraft[],
  ): Promise<EventOrder | null>;
  /** Approves or rejects an order under review (null: not under review). */
  review(
    id: string,
    decision: {
      status: EventOrderStatus.CONFIRMED | EventOrderStatus.REJECTED;
      reviewerId: string;
      reason: string | null;
      at: Date;
    },
    notices: OutboxDraft[],
  ): Promise<EventOrder | null>;
  /** Cancels an unpaid order (null: not unpaid any more). */
  cancel(id: string, at: Date): Promise<EventOrder | null>;
  /** Unpaid orders past their time become EXPIRED; how many. */
  expire(now: Date): Promise<number>;
}

export const EVENT_ORDER_REPOSITORY = Symbol("EVENT_ORDER_REPOSITORY");
