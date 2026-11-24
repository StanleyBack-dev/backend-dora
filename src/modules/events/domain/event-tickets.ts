import {
  normalizePixReceiver,
  PIX_VIOLATION_MESSAGES,
  type PixReceiver,
  type PixViolation,
} from "@/shared/domain/pix";

// How a ticketed event charges. The manager sets the full price (inteira)
// once and the audiences it accepts (adults, children, seniors, students…),
// each paying the full price, half of it (meia-entrada), nothing, or a value
// of its own, with an optional age range. Plus which PIX receives (the
// condominium's or another one for this event) and an optional limit of
// tickets per unit.

/** Who a ticket is for (fixed list, each once per event). */
export enum TicketKind {
  ADULT = "ADULT",
  CHILD = "CHILD",
  INFANT = "INFANT",
  SENIOR = "SENIOR",
  STUDENT = "STUDENT",
  PCD = "PCD",
  TEACHER = "TEACHER",
}

export const TICKET_KIND_LABELS: Record<TicketKind, string> = {
  [TicketKind.ADULT]: "Adulto",
  [TicketKind.CHILD]: "Criança",
  [TicketKind.INFANT]: "Infantil",
  [TicketKind.SENIOR]: "Idoso",
  [TicketKind.STUDENT]: "Estudante",
  [TicketKind.PCD]: "PcD",
  [TicketKind.TEACHER]: "Professor",
};

/**
 * Audiences by a condition the app can't know (not by age): a discounted
 * ticket for them always needs a document (student card, PcD report,
 * teacher's proof).
 */
export const CONDITION_KINDS: ReadonlySet<TicketKind> = new Set([
  TicketKind.STUDENT,
  TicketKind.PCD,
  TicketKind.TEACHER,
]);

/** What an audience pays, relative to the full price. */
export enum TicketPriceMode {
  /** Inteira. */
  FULL = "FULL",
  /** Meia-entrada: half the full price. */
  HALF = "HALF",
  FREE = "FREE",
  /** A value of its own. */
  CUSTOM = "CUSTOM",
}

export enum EventPixSource {
  /** The condominium's PIX (set by its managers). */
  CONDOMINIUM = "CONDOMINIUM",
  /** Another PIX just for this event (e.g. the party committee). */
  CUSTOM = "CUSTOM",
}

export type TicketType = {
  id: string;
  kind: TicketKind;
  /** The kind's label ("Criança"). */
  name: string;
  priceMode: TicketPriceMode;
  /** With CUSTOM: the value. */
  customPriceCents: number | null;
  /** What it costs, from the event's full price. */
  priceCents: number;
  /** Age range, both ends included (null: any age). */
  minAge: number | null;
  maxAge: number | null;
};

export type TicketTypeInput = {
  /** An existing type of the event (kept, so its orders keep pointing to it). */
  id?: string | null;
  kind: TicketKind;
  priceMode: TicketPriceMode;
  customPriceCents?: number | null;
  minAge?: number | null;
  maxAge?: number | null;
};

/** A checked type; id null: a new one. */
export type TicketTypeData = Omit<TicketType, "id" | "name" | "priceCents"> & {
  id: string | null;
};

/** The charging setup of an event (nothing when entry is free). */
export type EventTicketing = {
  /** Inteira (null on a free event). */
  fullPriceCents: number | null;
  ticketTypes: TicketTypeData[];
  /** Most tickets per unit (null: only the capacity limits). */
  unitTicketLimit: number | null;
  pixSource: EventPixSource | null;
  /** With CUSTOM: the event's own PIX. */
  customPix: PixReceiver | null;
};

export type EventTicketingInput = {
  fullPriceCents?: number | null;
  ticketTypes?: TicketTypeInput[] | null;
  unitTicketLimit?: number | null;
  pixSource?: EventPixSource | null;
  customPix?: PixReceiver | null;
};

export const TICKET_TYPES_MAX = Object.keys(TicketKind).length;
/** R$ 100.000,00: a typo guard, not a business rule. */
export const TICKET_PRICE_MAX_CENTS = 10_000_000;
export const AGE_MAX = 120;
export const UNIT_TICKET_LIMIT_MAX = 1000;

export type TicketingViolation =
  | "full-price"
  | "types-missing"
  | "types-too-many"
  | "type-kind"
  | "type-duplicate"
  | "type-price-mode"
  | "type-price"
  | "type-ages"
  | "unit-limit"
  | "pix-source"
  | PixViolation;

export const TICKETING_VIOLATION_MESSAGES: Record<TicketingViolation, string> =
  {
    "full-price": "Informe o valor da inteira (de R$ 0,01 a R$ 100.000,00).",
    "types-missing": "Marque pelo menos um público aceito.",
    "types-too-many": `Um evento pode ter até ${TICKET_TYPES_MAX} públicos.`,
    "type-kind": "Escolha cada público na lista.",
    "type-duplicate": "Cada público pode aparecer uma vez por evento.",
    "type-price-mode":
      "Escolha quanto cada público paga: inteira, meia, grátis ou outro valor.",
    "type-price": "O outro valor deve ser de R$ 0,00 a R$ 100.000,00.",
    "type-ages": `A faixa de idade vai de 0 a ${AGE_MAX} anos, com o início antes do fim.`,
    "unit-limit": `O limite por unidade deve ser um número inteiro de 1 a ${UNIT_TICKET_LIMIT_MAX}.`,
    "pix-source": "Escolha o PIX que recebe: o do condomínio ou outro.",
    ...PIX_VIOLATION_MESSAGES,
  };

const age = (value: number | null | undefined): number | null | "bad" => {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && value >= 0 && value <= AGE_MAX
    ? value
    : "bad";
};

const isCents = (value: number | null | undefined, min: number) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= TICKET_PRICE_MAX_CENTS;

/** What a type costs: the full price, half of it, nothing or its own. */
export function priceOf(
  type: Pick<TicketType, "priceMode" | "customPriceCents">,
  fullPriceCents: number,
): number {
  switch (type.priceMode) {
    case TicketPriceMode.FULL:
      return fullPriceCents;
    case TicketPriceMode.HALF:
      return Math.round(fullPriceCents / 2);
    case TicketPriceMode.FREE:
      return 0;
    case TicketPriceMode.CUSTOM:
      return type.customPriceCents ?? 0;
  }
}

/**
 * The charging setup, checked. A free event keeps none of it; a ticketed
 * one needs the full price, at least one audience (each once, with how much
 * it pays) and a PIX source (with CUSTOM, a valid receiver). A PIX is needed
 * even when every audience is free: the setup must work the day it changes.
 */
export function normalizeTicketing(
  ticketed: boolean,
  input: EventTicketingInput,
): EventTicketing | TicketingViolation {
  if (!ticketed) {
    return {
      fullPriceCents: null,
      ticketTypes: [],
      unitTicketLimit: null,
      pixSource: null,
      customPix: null,
    };
  }

  const fullPriceCents = input.fullPriceCents ?? null;
  if (!isCents(fullPriceCents, 1)) return "full-price";

  const raw = input.ticketTypes ?? [];
  if (raw.length === 0) return "types-missing";
  if (raw.length > TICKET_TYPES_MAX) return "types-too-many";
  const ticketTypes: TicketTypeData[] = [];
  const kinds = new Set<TicketKind>();
  for (const type of raw) {
    if (!Object.values(TicketKind).includes(type.kind)) return "type-kind";
    if (kinds.has(type.kind)) return "type-duplicate";
    kinds.add(type.kind);
    if (!Object.values(TicketPriceMode).includes(type.priceMode)) {
      return "type-price-mode";
    }
    const custom = type.priceMode === TicketPriceMode.CUSTOM;
    if (custom && !isCents(type.customPriceCents, 0)) return "type-price";
    const minAge = age(type.minAge);
    const maxAge = age(type.maxAge);
    if (
      minAge === "bad" ||
      maxAge === "bad" ||
      (minAge !== null && maxAge !== null && minAge > maxAge)
    ) {
      return "type-ages";
    }
    ticketTypes.push({
      id: type.id || null,
      kind: type.kind,
      priceMode: type.priceMode,
      customPriceCents: custom ? (type.customPriceCents as number) : null,
      minAge,
      maxAge,
    });
  }

  const limit = input.unitTicketLimit ?? null;
  if (
    limit !== null &&
    (!Number.isInteger(limit) || limit < 1 || limit > UNIT_TICKET_LIMIT_MAX)
  ) {
    return "unit-limit";
  }

  const pixSource = input.pixSource ?? null;
  if (!pixSource) return "pix-source";
  let customPix: PixReceiver | null = null;
  if (pixSource === EventPixSource.CUSTOM) {
    if (!input.customPix) return "key-type";
    const receiver = normalizePixReceiver(input.customPix);
    if (typeof receiver === "string") return receiver;
    customPix = receiver;
  }

  return {
    fullPriceCents,
    ticketTypes,
    unitTicketLimit: limit,
    pixSource,
    customPix,
  };
}

/** Whether a type fits this age (no range: any age). */
export const fitsAge = (
  type: Pick<TicketType, "minAge" | "maxAge">,
  personAge: number,
) =>
  (type.minAge === null || personAge >= type.minAge) &&
  (type.maxAge === null || personAge <= type.maxAge);

/**
 * A ticket that needs a document: a discounted one for a condition
 * (student, PcD, teacher), or a discount by age when the app doesn't know
 * the person's birth date.
 */
export function needsProof(
  type: Pick<TicketType, "kind" | "minAge" | "maxAge">,
  priceCents: number,
  fullPriceCents: number,
  ageKnown: boolean,
): boolean {
  if (priceCents >= fullPriceCents) return false;
  if (CONDITION_KINDS.has(type.kind)) return true;
  const byAge = type.minAge !== null || type.maxAge !== null;
  return byAge && !ageKnown;
}
