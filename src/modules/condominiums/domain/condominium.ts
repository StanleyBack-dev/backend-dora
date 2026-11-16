import { BRAZILIAN_STATES } from "@/shared/domain/brazilian-address";

// A condominium is a tenant of the platform: its members, units, sign-ups and
// announcements (and later its spaces and bookings) belong to it. Only the
// platform administrator creates, edits or suspends one.

export enum CondominiumStatus {
  ACTIVE = "ACTIVE",
  /** Members can't work in it (e.g. contract ended); data is kept. */
  SUSPENDED = "SUSPENDED",
}

/**
 * How homes are identified: apartments (block and number) or houses
 * (street, quadra and lote). Decides what residents type on the sign-up.
 */
export enum AddressFormat {
  APARTMENT = "APARTMENT",
  HOUSE = "HOUSE",
}

export type Condominium = {
  id: string;
  name: string;
  /** CNPJ, digits only (optional). */
  document: string | null;
  city: string;
  /** UF, e.g. "SP". */
  state: string;
  status: CondominiumStatus;
  addressFormat: AddressFormat;
  createdAt: Date;
  updatedAt: Date;
};

export type CondominiumDraft = {
  name: string;
  document?: string | null;
  city: string;
  state: string;
  /** Apartments when not given. */
  addressFormat?: AddressFormat;
};

export type CondominiumViolation = "name" | "document" | "city" | "state";

// The UF list is shared with other addresses (events outside the condominium).
export { BRAZILIAN_STATES } from "@/shared/domain/brazilian-address";
import { isValidCnpj } from "@/shared/domain/cnpj";
export { isValidCnpj };

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/** Trimmed and validated; the first problem found otherwise. */
export function normalizeCondominium(
  draft: CondominiumDraft,
):
  | (Required<Omit<CondominiumDraft, "addressFormat">> &
      Pick<CondominiumDraft, "addressFormat">)
  | CondominiumViolation {
  const name = collapse(draft.name);
  if (name.length < 2 || name.length > 120) return "name";

  const digits = (draft.document ?? "").replace(/\D/g, "");
  const document = digits === "" ? null : digits;
  if (document !== null && !isValidCnpj(document)) return "document";

  const city = collapse(draft.city);
  if (city.length < 2 || city.length > 80) return "city";

  const state = draft.state.trim().toUpperCase();
  if (!BRAZILIAN_STATES.includes(state)) return "state";

  return {
    name,
    document,
    city,
    state,
    addressFormat: draft.addressFormat,
  };
}
