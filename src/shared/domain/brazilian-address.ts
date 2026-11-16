// A Brazilian street address (somewhere outside a condominium): CEP, street,
// number (or "S/N"), complement, district, city and UF. Shared by the
// modules that need one (events held outside the condominium).

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

/** The number of a place without one. */
export const NO_NUMBER = "S/N";

export type BrazilianAddress = {
  /** 8 digits. */
  zip: string;
  street: string;
  /** "123", "12-A" or "S/N". */
  number: string;
  complement: string | null;
  district: string;
  city: string;
  /** UF, e.g. "GO". */
  state: string;
};

export type BrazilianAddressInput = {
  zip: string;
  street: string;
  number: string;
  complement?: string | null;
  district: string;
  city: string;
  state: string;
};

export type AddressViolation =
  "zip" | "street" | "number" | "complement" | "district" | "city" | "state";

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");
const sized = (value: string, min: number, max: number) =>
  value.length >= min && value.length <= max;

/** Trimmed and checked; the first problem otherwise. */
export function normalizeAddress(
  input: BrazilianAddressInput,
): BrazilianAddress | AddressViolation {
  const zip = input.zip.replace(/\D/g, "");
  if (!/^\d{8}$/.test(zip)) return "zip";
  const street = collapse(input.street);
  if (!sized(street, 2, 120)) return "street";
  const typed = collapse(input.number).toUpperCase();
  const number = /^S\s*\/?\s*N$/.test(typed) ? NO_NUMBER : typed;
  if (number !== NO_NUMBER && !/^[0-9][0-9A-Z \-/]{0,9}$/.test(number)) {
    return "number";
  }
  const complement = collapse(input.complement ?? "");
  if (complement.length > 80) return "complement";
  const district = collapse(input.district);
  if (!sized(district, 2, 80)) return "district";
  const city = collapse(input.city);
  if (!sized(city, 2, 80)) return "city";
  const state = input.state.trim().toUpperCase();
  if (!BRAZILIAN_STATES.includes(state)) return "state";
  return {
    zip,
    street,
    number,
    complement: complement || null,
    district,
    city,
    state,
  };
}

export const ADDRESS_VIOLATION_MESSAGES: Record<AddressViolation, string> = {
  zip: "Informe o CEP com 8 números.",
  street: "Informe a rua (2 a 120 caracteres).",
  number: 'Informe o número (ou marque "sem número").',
  complement: "O complemento pode ter até 80 caracteres.",
  district: "Informe o bairro (2 a 80 caracteres).",
  city: "Informe a cidade (2 a 80 caracteres).",
  state: "Escolha a UF.",
};

/** "Rua das Flores, 123, casa 2 - Centro, Goiânia/GO, 74000-000". */
export function formatAddress(address: BrazilianAddress): string {
  const zip = `${address.zip.slice(0, 5)}-${address.zip.slice(5)}`;
  const line = [address.street, address.number, address.complement]
    .filter(Boolean)
    .join(", ");
  return `${line} - ${address.district}, ${address.city}/${address.state}, ${zip}`;
}
