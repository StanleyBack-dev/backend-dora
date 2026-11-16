import {
  ADDRESS_VIOLATION_MESSAGES,
  normalizeAddress,
  type AddressViolation,
  type BrazilianAddress,
  type BrazilianAddressInput,
} from "@/shared/domain/brazilian-address";

// A condominium event (festa junina, assembly party, show…): when, where,
// how many people fit (and how many of them may come from outside) and
// whether entry needs a paid ticket. It happens in a space of the
// condominium or outside it, at a full street address. Managers create it as
// a draft, publish it (residents are told) and may cancel it. Tickets and the
// gate come in later stages.

export enum EventStatus {
  /** Only managers see it. */
  DRAFT = "DRAFT",
  /** Residents see it (and were told). */
  PUBLISHED = "PUBLISHED",
  /** Called off; kept so residents see it was cancelled. */
  CANCELLED = "CANCELLED",
}

export type CondominiumEvent = {
  id: string;
  condominiumId: string;
  title: string;
  description: string | null;
  /** A space of the condominium (null: outside, at `address`). */
  spaceId: string | null;
  /**
   * With a space, an optional detail ("área coberta"); outside, the name
   * of the place ("Chácara Bela Vista").
   */
  location: string | null;
  /** Outside the condominium: where (null with a space). */
  address: BrazilianAddress | null;
  startsAt: Date;
  endsAt: Date;
  /** Most people in total. */
  capacity: number;
  /** Most guests from outside the condominium (0: residents only). */
  externalGuestLimit: number;
  /** Entry needs a paid ticket (PIX); otherwise a free ticket. */
  ticketed: boolean;
  status: EventStatus;
  cancelReason: string | null;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type EventInput = {
  title: string;
  description?: string | null;
  spaceId?: string | null;
  location?: string | null;
  /** Required without a space (the event is outside the condominium). */
  address?: BrazilianAddressInput | null;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  externalGuestLimit: number;
  ticketed: boolean;
};

export type EventData = {
  title: string;
  description: string | null;
  spaceId: string | null;
  location: string | null;
  address: BrazilianAddress | null;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  externalGuestLimit: number;
  ticketed: boolean;
};

export type EventViolation =
  | "title"
  | "description"
  | "place"
  | "location"
  | "period"
  | "too-long"
  | "past"
  | "capacity"
  | "guests"
  | AddressViolation;

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 4000;
export const LOCATION_MAX = 120;
/** Longest event (a weekend festival fits; a typo of a month doesn't). */
export const EVENT_MAX_DAYS = 7;
export const PEOPLE_MAX = 100_000;
export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 400;

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/** Checked and trimmed; the first problem otherwise. */
export function normalizeEvent(
  input: EventInput,
  now: Date,
): EventData | EventViolation {
  const title = collapse(input.title);
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) return "title";

  const description = (input.description ?? "").trim();
  if (description.length > DESCRIPTION_MAX) return "description";

  const location = collapse(input.location ?? "");
  if (location.length > LOCATION_MAX) return "location";

  // In a space, or outside at a full address (never both).
  const spaceId = input.spaceId || null;
  let address: BrazilianAddress | null = null;
  if (!spaceId) {
    if (!input.address) return "place";
    const checked = normalizeAddress(input.address);
    if (typeof checked === "string") return checked;
    address = checked;
  }

  const start = input.startsAt.getTime();
  const end = input.endsAt.getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return "period";
  }
  if (end - start > EVENT_MAX_DAYS * 86_400_000) return "too-long";
  if (start < now.getTime()) return "past";

  const { capacity, externalGuestLimit } = input;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > PEOPLE_MAX) {
    return "capacity";
  }
  if (
    !Number.isInteger(externalGuestLimit) ||
    externalGuestLimit < 0 ||
    externalGuestLimit > capacity
  ) {
    return "guests";
  }

  return {
    title,
    description: description || null,
    spaceId,
    location: location || null,
    address,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    capacity,
    externalGuestLimit,
    ticketed: input.ticketed,
  };
}

export const EVENT_VIOLATION_MESSAGES: Record<EventViolation, string> = {
  title: `O título tem de ${TITLE_MIN} a ${TITLE_MAX} caracteres.`,
  description: `A descrição pode ter até ${DESCRIPTION_MAX} caracteres.`,
  place:
    "Escolha o espaço do evento ou informe o endereço do local fora do condomínio.",
  location: `O nome do local pode ter até ${LOCATION_MAX} caracteres.`,
  period: "O fim do evento deve ser depois do início.",
  "too-long": `Um evento pode durar até ${EVENT_MAX_DAYS} dias.`,
  past: "O evento deve começar no futuro.",
  capacity: "Informe a lotação total: um número inteiro a partir de 1.",
  guests:
    "O número de convidados de fora deve ser um inteiro entre 0 e a lotação total.",
  ...ADDRESS_VIOLATION_MESSAGES,
};

/** Still changeable: not cancelled and not over. */
export const isOpen = (
  event: Pick<CondominiumEvent, "status" | "endsAt">,
  now: Date,
) => event.status !== EventStatus.CANCELLED && event.endsAt > now;

/** Trimmed reason; null when too short or too long. */
export function normalizeCancelReason(value: string): string | null {
  const reason = collapse(value);
  return reason.length >= CANCEL_REASON_MIN &&
    reason.length <= CANCEL_REASON_MAX
    ? reason
    : null;
}
