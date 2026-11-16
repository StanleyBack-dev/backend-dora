import { isValidCnpj } from "@/shared/domain/cnpj";
import { normalizeCpf } from "@/shared/domain/identity-document";

// PIX "copia e cola" (BR Code, Banco Central): EMV fields "id + length +
// value" ending with a CRC16 of the whole text. Static code, so the bank app
// opens with the amount filled in and the order code as the reference
// (txid): whoever reviews the receipt finds the payment by that code.
// The key comes with its type (CPF, CNPJ, phone, e-mail or random key) and
// is checked by that type's rules, so a typo never becomes a wrong key.

export enum PixKeyType {
  CPF = "CPF",
  CNPJ = "CNPJ",
  PHONE = "PHONE",
  EMAIL = "EMAIL",
  RANDOM = "RANDOM",
}

export type PixReceiver = {
  keyType: PixKeyType;
  /** As the BR Code expects it (see normalizePixKey). */
  key: string;
  /** Receiver's name as the bank shows it (up to 25 characters). */
  name: string;
  /** Receiver's city (up to 15 characters). */
  city: string;
};

export const PIX_NAME_MAX = 25;
export const PIX_CITY_MAX = 15;
export const PIX_KEY_MAX = 77;
/** The reference (txid): letters and digits, up to 25. */
export const PIX_TXID_MAX = 25;

export type PixViolation =
  | "key-type"
  | "key-cpf"
  | "key-cnpj"
  | "key-phone"
  | "key-email"
  | "key-random"
  | "name"
  | "city";

export const PIX_VIOLATION_MESSAGES: Record<PixViolation, string> = {
  "key-type": "Escolha o tipo da chave PIX.",
  "key-cpf": "CPF inválido: confira os 11 números da chave PIX.",
  "key-cnpj": "CNPJ inválido: confira os 14 números da chave PIX.",
  "key-phone":
    "Celular inválido: informe o DDD e o número com 9 dígitos, ex.: (62) 99999-0000.",
  "key-email": "E-mail inválido para a chave PIX.",
  "key-random":
    "Chave aleatória inválida: copie do app do banco (32 letras e números, com hífens).",
  name: `Informe o nome de quem recebe (até ${PIX_NAME_MAX} letras, como aparece no banco).`,
  city: `Informe a cidade de quem recebe (até ${PIX_CITY_MAX} letras).`,
};

/** Plain ASCII, upper case: what the BR Code allows in name and city. */
export const pixPlain = (value: string, max: number) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RANDOM_KEY = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/;
/** Only digits and the masks' punctuation (letters refused). */
const NUMERIC = /^[0-9.\-/()+\s]+$/;
/** A phone: digits, spaces, parentheses, hyphen and "+" (no dots). */
const PHONE_CHARS = /^[0-9()+\-\s]+$/;
/** Brazilian area codes (DDD) in use. */
const DDDS = new Set(
  (
    "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 " +
    "41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 " +
    "71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99"
  ).split(" "),
);

/**
 * The key of a given type as the BR Code expects it, or null when it breaks
 * that type's rules:
 * - CPF: 11 digits with valid check digits;
 * - CNPJ: 14 digits with valid check digits;
 * - PHONE: a Brazilian mobile, a real DDD + 9 digits starting with 9 →
 *   "+55…";
 * - EMAIL: lower case;
 * - RANDOM: the bank's UUID, lower case.
 */
export function normalizePixKey(type: PixKeyType, raw: string): string | null {
  const value = raw.trim();
  if (!value || value.length > PIX_KEY_MAX) return null;
  switch (type) {
    case PixKeyType.CPF:
      return normalizeCpf(value);
    case PixKeyType.CNPJ: {
      if (!NUMERIC.test(value)) return null;
      const digits = value.replace(/\D/g, "");
      return isValidCnpj(digits) ? digits : null;
    }
    case PixKeyType.PHONE: {
      if (!PHONE_CHARS.test(value)) return null;
      let digits = value.replace(/\D/g, "");
      if (digits.length === 13 && digits.startsWith("55")) {
        digits = digits.slice(2);
      }
      return /^\d{2}9\d{8}$/.test(digits) && DDDS.has(digits.slice(0, 2))
        ? `+55${digits}`
        : null;
    }
    case PixKeyType.EMAIL: {
      const email = value.toLowerCase();
      return EMAIL.test(email) ? email : null;
    }
    case PixKeyType.RANDOM: {
      const key = value.toLowerCase();
      return RANDOM_KEY.test(key) ? key : null;
    }
    default:
      return null;
  }
}

const KEY_VIOLATION: Record<PixKeyType, PixViolation> = {
  [PixKeyType.CPF]: "key-cpf",
  [PixKeyType.CNPJ]: "key-cnpj",
  [PixKeyType.PHONE]: "key-phone",
  [PixKeyType.EMAIL]: "key-email",
  [PixKeyType.RANDOM]: "key-random",
};

/** Checked receiver (key by its type, name and city in BR Code form). */
export function normalizePixReceiver(
  input: PixReceiver,
): PixReceiver | PixViolation {
  if (!Object.values(PixKeyType).includes(input.keyType)) return "key-type";
  const key = normalizePixKey(input.keyType, input.key);
  if (!key) return KEY_VIOLATION[input.keyType];
  const name = pixPlain(input.name, PIX_NAME_MAX);
  if (name.length < 2) return "name";
  const city = pixPlain(input.city, PIX_CITY_MAX);
  if (city.length < 2) return "city";
  return { keyType: input.keyType, key, name, city };
}

/** One field: two-digit id, two-digit length, value. */
const field = (id: string, value: string) =>
  `${id}${String(value.length).padStart(2, "0")}${value}`;

/** CRC16-CCITT (polynomial 0x1021, initial 0xFFFF), as the BR Code asks. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i += 1) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * The "copia e cola" text (also what the QR code carries) for an amount in
 * cents and a reference; the receiver must already be normalized.
 */
export function pixPayload(
  receiver: Pick<PixReceiver, "key" | "name" | "city">,
  amountCents: number,
  txid: string,
): string {
  const reference =
    txid.replace(/[^A-Za-z0-9]/g, "").slice(0, PIX_TXID_MAX) || "***";
  const body = [
    field("00", "01"),
    field("26", field("00", "br.gov.bcb.pix") + field("01", receiver.key)),
    field("52", "0000"),
    field("53", "986"),
    field("54", (amountCents / 100).toFixed(2)),
    field("58", "BR"),
    field("59", pixPlain(receiver.name, PIX_NAME_MAX)),
    field("60", pixPlain(receiver.city, PIX_CITY_MAX)),
    field("62", field("05", reference)),
    "6304",
  ].join("");
  return body + crc16(body);
}
