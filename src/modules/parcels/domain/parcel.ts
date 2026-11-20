// A parcel (encomenda) the gate (Portaria) received for a unit. Residents
// of the unit are told and pick it up at the gate by showing its code
// (typed, or read from the QR in the app) and signing on the gate's screen.
// It ends picked up, returned to the sender, or cancelled (registered by
// mistake).

export enum ParcelStatus {
  /** At the gate, waiting for someone of the unit. */
  RECEIVED = "RECEIVED",
  PICKED_UP = "PICKED_UP",
  /** Sent back to the sender (refused, wrong address, not picked up). */
  RETURNED = "RETURNED",
  /** Registered by mistake. */
  CANCELLED = "CANCELLED",
}

/**
 * The pickup code: 6 characters, so the gate tells it apart from a booking
 * guest's invite (8) and an event ticket (10) by the length alone.
 */
export const PARCEL_CODE_LENGTH = 6;
export const PARCEL_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Waiting this long, the unit is reminded once. */
export const PARCEL_REMINDER_DAYS = 3;
/** The photo is kept this long after the parcel left the gate. */
export const PARCEL_PHOTO_RETENTION_DAYS = 90;

/** A pickup code from `random(n)` (an integer in [0, n)). */
export function parcelCode(random: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < PARCEL_CODE_LENGTH; i += 1) {
    code += PARCEL_CODE_ALPHABET[random(PARCEL_CODE_ALPHABET.length)];
  }
  return code;
}

/** A typed or scanned code, upper case without spaces or dashes; null: not one. */
export function normalizeParcelCode(value: string): string | null {
  const code = value.toUpperCase().replace(/[\s.·-]/g, "");
  const valid =
    code.length === PARCEL_CODE_LENGTH &&
    [...code].every((char) => PARCEL_CODE_ALPHABET.includes(char));
  return valid ? code : null;
}

/** Limits of the free-text fields (characters). */
export const PARCEL_TEXT_LIMITS = {
  recipientName: 120,
  carrier: 60,
  trackingCode: 60,
  notes: 300,
  storageLocation: 60,
} as const;

export type ParcelTextField = keyof typeof PARCEL_TEXT_LIMITS;

/**
 * An optional text: trimmed, inner spaces collapsed, "" -> null; undefined
 * when it is longer than the field allows.
 */
export function optionalText(
  value: string | null | undefined,
  max: number,
): string | null | undefined {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= max ? text : undefined;
}

/** Why a parcel is returned or cancelled: 3 to 300 characters. */
export function normalizeCloseReason(value: string | null | undefined) {
  const reason = (value ?? "").trim().replace(/\s+/g, " ");
  return reason.length >= 3 && reason.length <= 300 ? reason : null;
}

/** Only a parcel still at the gate can be picked up, returned or cancelled. */
export const isOpen = (status: ParcelStatus) =>
  status === ParcelStatus.RECEIVED;
