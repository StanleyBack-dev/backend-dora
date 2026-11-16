import {
  AGE_MAX,
  fitsAge,
  needsProof,
  type TicketType,
} from "@/modules/events/domain/event-tickets";
import { ageOn } from "@/shared/domain/birth-date";

// A member's order for an event: the people going and, on a ticketed
// event, a ticket (audience) for each. A person is the buyer themselves or
// an approved dependent (their age comes from the birth date the app
// knows), or someone else (name and age typed). A discounted ticket whose
// age the app can't confirm, or one for a condition (student, PcD,
// teacher), needs that person's document. While a receipt or a document is
// missing the order holds its places for 48 hours (never past the start);
// then the managers review it. An order with nothing to pay nor prove is
// confirmed right away.

export enum EventOrderStatus {
  /** Places held until `expiresAt`, waiting for the receipt / documents. */
  PENDING_PAYMENT = "PENDING_PAYMENT",
  /** Everything sent, waiting for a manager. */
  AWAITING_REVIEW = "AWAITING_REVIEW",
  /** Paid (or free) and checked: the places are the person's. */
  CONFIRMED = "CONFIRMED",
  /** The manager didn't accept it (with the reason). */
  REJECTED = "REJECTED",
  /** Not sent in time: the places went back. */
  EXPIRED = "EXPIRED",
  /** Called off by the person (or with the event). */
  CANCELLED = "CANCELLED",
}

/** Statuses that hold places (PENDING_PAYMENT only until it expires). */
export const HOLDING_STATUSES = [
  EventOrderStatus.PENDING_PAYMENT,
  EventOrderStatus.AWAITING_REVIEW,
  EventOrderStatus.CONFIRMED,
] as const;

/** Who a person of an order is. */
export enum AttendeeSource {
  /** The buyer (age from their birth date). */
  SELF = "SELF",
  /** An approved dependent of the buyer (age from its birth date). */
  DEPENDENT = "DEPENDENT",
  /** Someone else (name and age typed). */
  GUEST = "GUEST",
}

export type Attendee = {
  source: AttendeeSource;
  dependentId: string | null;
  name: string;
  age: number;
  /** From outside the condominium (counts against the guests limit). */
  outside: boolean;
  /** The ticket type (null on a free event). */
  ticketTypeId: string | null;
  /** Snapshot of the type's name and price when ordered. */
  ticketName: string | null;
  priceCents: number;
  /** A document is required for this ticket. */
  needsProof: boolean;
  proofKey: string | null;
  proofContentType: string | null;
};

export type AttendeeInput = {
  source: AttendeeSource;
  /** DEPENDENT: which one. */
  dependentId?: string | null;
  /** GUEST: typed. */
  name?: string | null;
  age?: number | null;
  /** GUEST: from outside the condominium. */
  outside: boolean;
  ticketTypeId?: string | null;
};

/** Someone the app knows (the buyer or an approved dependent). */
export type KnownPerson = { name: string; birthDate: string };

export type OrderContext = {
  ticketTypes: TicketType[];
  ticketed: boolean;
  /** The event's full price (0 on a free event). */
  fullPriceCents: number;
  /** The event's first day (YYYY-MM-DD): ages are taken on it. */
  eventDay: string;
  /** The buyer (null: no birth date informed yet). */
  self: KnownPerson | null;
  /** The buyer's approved dependents, by id. */
  dependents: ReadonlyMap<string, KnownPerson>;
};

export const PAYMENT_HOLD_HOURS = 48;
export const ATTENDEES_MAX = 20;
export const ATTENDEE_NAME_MIN = 3;
export const ATTENDEE_NAME_MAX = 80;
export const REJECT_REASON_MIN = 3;
export const REJECT_REASON_MAX = 300;

export type OrderViolation =
  | "empty"
  | "too-many"
  | "self-unknown"
  | "self-twice"
  | "dependent-unknown"
  | "dependent-twice"
  | "name"
  | "age"
  | "type-missing"
  | "type-unknown"
  | "type-age";

export const ORDER_VIOLATION_MESSAGES: Record<OrderViolation, string> = {
  empty: "Informe quem vai ao evento.",
  "too-many": `Um pedido pode ter até ${ATTENDEES_MAX} pessoas.`,
  "self-unknown":
    "Informe sua data de nascimento em Meu perfil para se incluir no pedido.",
  "self-twice": "Você só pode estar uma vez no pedido.",
  "dependent-unknown":
    "Dependente não encontrado ou ainda não aprovado pela administração.",
  "dependent-twice": "Cada dependente só pode estar uma vez no pedido.",
  name: `Informe o nome completo de cada pessoa (${ATTENDEE_NAME_MIN} a ${ATTENDEE_NAME_MAX} letras).`,
  age: `Informe a idade de cada pessoa (0 a ${AGE_MAX} anos).`,
  "type-missing": "Escolha o ingresso de cada pessoa.",
  "type-unknown": "Ingresso inexistente neste evento.",
  "type-age": "A idade não confere com a faixa do ingresso escolhido.",
};

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/**
 * The people of an order: who each one is (name and age, known or typed),
 * the ticket with its price and whether it needs a document.
 */
export function normalizeAttendees(
  input: AttendeeInput[],
  context: OrderContext,
): Attendee[] | OrderViolation {
  if (input.length === 0) return "empty";
  if (input.length > ATTENDEES_MAX) return "too-many";
  const attendees: Attendee[] = [];
  let self = false;
  const dependents = new Set<string>();

  for (const person of input) {
    let name: string;
    let age: number;
    let ageKnown = false;
    let outside = person.outside;
    if (person.source === AttendeeSource.SELF) {
      if (self) return "self-twice";
      if (!context.self) return "self-unknown";
      self = true;
      name = context.self.name;
      age = ageOn(context.self.birthDate, context.eventDay);
      ageKnown = true;
      outside = false;
    } else if (person.source === AttendeeSource.DEPENDENT) {
      const known = person.dependentId
        ? context.dependents.get(person.dependentId)
        : undefined;
      if (!known || !person.dependentId) return "dependent-unknown";
      if (dependents.has(person.dependentId)) return "dependent-twice";
      dependents.add(person.dependentId);
      name = known.name;
      age = ageOn(known.birthDate, context.eventDay);
      ageKnown = true;
      outside = false;
    } else {
      name = collapse(person.name ?? "");
      if (name.length < ATTENDEE_NAME_MIN || name.length > ATTENDEE_NAME_MAX) {
        return "name";
      }
      const typed = person.age;
      if (
        typeof typed !== "number" ||
        !Number.isInteger(typed) ||
        typed < 0 ||
        typed > AGE_MAX
      ) {
        return "age";
      }
      age = typed;
    }

    const base = {
      source: person.source,
      dependentId:
        person.source === AttendeeSource.DEPENDENT
          ? (person.dependentId ?? null)
          : null,
      name,
      age,
      outside,
      proofKey: null,
      proofContentType: null,
    };
    if (!context.ticketed) {
      attendees.push({
        ...base,
        ticketTypeId: null,
        ticketName: null,
        priceCents: 0,
        needsProof: false,
      });
      continue;
    }
    if (!person.ticketTypeId) return "type-missing";
    const type = context.ticketTypes.find(
      (item) => item.id === person.ticketTypeId,
    );
    if (!type) return "type-unknown";
    if (!fitsAge(type, age)) return "type-age";
    attendees.push({
      ...base,
      ticketTypeId: type.id,
      ticketName: type.name,
      priceCents: type.priceCents,
      needsProof: needsProof(
        type,
        type.priceCents,
        context.fullPriceCents,
        ageKnown,
      ),
    });
  }
  return attendees;
}

export const orderTotal = (
  attendees: readonly Pick<Attendee, "priceCents">[],
) => attendees.reduce((sum, person) => sum + person.priceCents, 0);

/** Until when a pending order holds its places: 48 h, never past the start. */
export const paymentDeadline = (now: Date, eventStartsAt: Date): Date =>
  new Date(
    Math.min(
      now.getTime() + PAYMENT_HOLD_HOURS * 3_600_000,
      eventStartsAt.getTime(),
    ),
  );

// No 0/O, 1/I/L: easy to read on a bank statement and to type.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** A short order code (also the PIX reference): "EV" + 6 characters. */
export function orderCode(random: (max: number) => number): string {
  let code = "EV";
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  }
  return code;
}

/** Trimmed reason; null when too short or too long. */
export function normalizeRejectReason(value: string): string | null {
  const reason = collapse(value);
  return reason.length >= REJECT_REASON_MIN &&
    reason.length <= REJECT_REASON_MAX
    ? reason
    : null;
}
