// A condominium is a tenant of the platform: its members, units, sign-ups and
// announcements (and later its spaces and bookings) belong to it. Only the
// platform administrator creates, edits or suspends one.

export enum CondominiumStatus {
  ACTIVE = "ACTIVE",
  /** Members can't work in it (e.g. contract ended); data is kept. */
  SUSPENDED = "SUSPENDED",
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
  createdAt: Date;
  updatedAt: Date;
};

export type CondominiumDraft = {
  name: string;
  document?: string | null;
  city: string;
  state: string;
};

export type CondominiumViolation = "name" | "document" | "city" | "state";

export const BRAZILIAN_STATES: readonly string[] = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/** CNPJ check digits (digits only, 14 long). */
export function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const check = (length: number) => {
    let weight = length - 7;
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * weight;
      weight = weight === 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** Trimmed and validated; the first problem found otherwise. */
export function normalizeCondominium(
  draft: CondominiumDraft,
): Required<CondominiumDraft> | CondominiumViolation {
  const name = collapse(draft.name);
  if (name.length < 2 || name.length > 120) return "name";

  const digits = (draft.document ?? "").replace(/\D/g, "");
  const document = digits === "" ? null : digits;
  if (document !== null && !isValidCnpj(document)) return "document";

  const city = collapse(draft.city);
  if (city.length < 2 || city.length > 80) return "city";

  const state = draft.state.trim().toUpperCase();
  if (!BRAZILIAN_STATES.includes(state)) return "state";

  return { name, document, city, state };
}
