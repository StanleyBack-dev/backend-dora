import {
  DocumentType,
  normalizeCpf,
  normalizeRg,
} from "@/shared/domain/identity-document";
import { normalizePhone } from "@/shared/domain/phone";

// Someone the booker brings. Each guest gets an invite whose code the gate
// (Portaria) types or scans to let them in.

export type BookingGuest = {
  id: string;
  bookingId: string;
  condominiumId: string;
  name: string;
  /** CPF or RG (null: not asked or not given). */
  documentType: DocumentType | null;
  /** Digits only (an RG may end in "X"). */
  document: string | null;
  /** Digits only (null: not given). */
  phone: string | null;
  /** What the invite's QR code carries. */
  code: string;
  checkedInAt: Date | null;
  checkedInBy: string | null;
  createdAt: Date;
};

export type GuestInput = {
  name: string;
  /** Which document `document` is (required with a document). */
  documentType?: DocumentType | null;
  document?: string | null;
  phone?: string | null;
};

export type GuestData = Pick<
  BookingGuest,
  "name" | "documentType" | "document" | "phone"
>;

export type GuestViolation =
  "name" | "document-type" | "cpf" | "rg" | "document-required" | "phone";

/** Most guests added in one go (the space's own limit applies too). */
export const MAX_GUESTS_PER_REQUEST = 100;

const collapse = (value: string) => value.trim().replace(/\s+/g, " ");

/** Trimmed and validated; the first problem otherwise. */
export function normalizeGuest(
  input: GuestInput,
  documentRequired: boolean,
): GuestData | GuestViolation {
  const name = collapse(input.name);
  if (name.length < 2 || name.length > 120) return "name";

  const typed = (input.document ?? "").trim();
  let document: string | null = null;
  let documentType: DocumentType | null = null;
  if (typed) {
    if (input.documentType === DocumentType.CPF) {
      document = normalizeCpf(typed);
      if (!document) return "cpf";
    } else if (input.documentType === DocumentType.RG) {
      document = normalizeRg(typed);
      if (!document) return "rg";
    } else {
      return "document-type";
    }
    documentType = input.documentType;
  }
  if (documentRequired && document === null) return "document-required";

  const rawPhone = (input.phone ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return "phone";

  return { name, documentType, document, phone };
}

// No 0/O, 1/I/L: easy to read aloud and to type at the gate.
export const GUEST_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const GUEST_CODE_LENGTH = 8;

/** A code from `random(n)` (an integer in [0, n)). */
export function guestCode(random: (n: number) => number): string {
  let code = "";
  for (let i = 0; i < GUEST_CODE_LENGTH; i += 1) {
    code += GUEST_CODE_ALPHABET[random(GUEST_CODE_ALPHABET.length)];
  }
  return code;
}

/** As typed at the gate: upper case, without spaces or dashes. */
export function normalizeGuestCode(value: string): string | null {
  const code = value.toUpperCase().replace(/[\s-]/g, "");
  const valid =
    code.length === GUEST_CODE_LENGTH &&
    [...code].every((char) => GUEST_CODE_ALPHABET.includes(char));
  return valid ? code : null;
}

/** The gate lets guests in from this long before the start. */
export const CHECK_IN_EARLY_MS = 3 * 3_600_000;

export type CheckInDenial = "too-early" | "finished" | "not-active";

/** Whether a guest can be let in now (null: yes). */
export function checkInDenial(
  booking: { startsAt: Date; endsAt: Date; active: boolean },
  now: Date,
): CheckInDenial | null {
  if (!booking.active) return "not-active";
  if (now >= booking.endsAt) return "finished";
  if (now.getTime() < booking.startsAt.getTime() - CHECK_IN_EARLY_MS) {
    return "too-early";
  }
  return null;
}

/** What a guest's invite says about the booking now. */
export enum GuestInviteStatus {
  /** The booking holds: show the code at the gate. */
  VALID = "VALID",
  /** Cancelled or rejected: the invite no longer works. */
  CANCELLED = "CANCELLED",
  /** The booking already ended. */
  ENDED = "ENDED",
}

export function inviteStatus(
  booking: { endsAt: Date; active: boolean },
  now: Date,
): GuestInviteStatus {
  if (!booking.active) return GuestInviteStatus.CANCELLED;
  if (booking.endsAt <= now) return GuestInviteStatus.ENDED;
  return GuestInviteStatus.VALID;
}

/** "Ana" of "Ana Souza": how the invite names the host. */
export const firstName = (name: string): string =>
  name.trim().split(/\s+/)[0] ?? name;
