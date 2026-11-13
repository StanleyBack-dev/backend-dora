export enum EnrollmentStatus {
  PENDENTE = "PENDENTE",
  APROVADA = "APROVADA",
  RECUSADA = "RECUSADA",
}

/**
 * Code a manager shares with a group of residents (one per cohort, valid
 * for everyone until it expires or is revoked). Kept readable so the manager
 * can copy it again while it is open; it only opens the form, and nothing
 * becomes an account without a manager's approval.
 */
export type EnrollmentInvite = {
  id: string;
  /** The condominium people join with this code. */
  condominiumId: string;
  code: string;
  label: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  /** Requests sent with this code. */
  requestCount: number;
};

/** What the resident fills in on the public form. */
export type EnrollmentData = {
  fullName: string;
  email: string;
  /** Digits only (DDD + number). */
  phone: string;
  /** Unit chosen on the form (required when the condominium has units). */
  unitId: string | null;
};

export type EnrollmentRequest = EnrollmentData & {
  id: string;
  condominiumId: string;
  inviteId: string | null;
  status: EnrollmentStatus;
  consentAt: Date;
  createdAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  /** Account created on approval. */
  userId: string | null;
  /** Profile photo in the object storage (optional). */
  photoKey: string | null;
};

/** Where sign-up photos are stored (a random name, never user input). */
export const enrollmentPhotoKey = (id: string) =>
  `profile-photos/enrollment/${id}.webp`;

// Connectors kept in lowercase inside a name ("João de Paula").
const NAME_PARTICLES = new Set(["da", "das", "de", "di", "do", "dos", "e"]);

export const INVITE_CODE_DIGITS = 6;

/** Digits only; accepts Brazilian landlines (10) and mobiles (11). */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return /^\d{10,11}$/.test(digits) ? digits : null;
}

// The login suggested from a name lives with the other login rules.
export { usernameBase } from "@/modules/identity/domain/username";

/** Full name as typed, single spaces; null when too short or too long. */
export function normalizeFullName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 5 && name.length <= 160 && name.includes(" ")
    ? name
    : null;
}

/**
 * The name as the project writes names, however it was typed (often all in
 * capitals): each word with only its first letter in uppercase, the
 * connectors in lowercase. "STANLEY BARROS RODRIGUES" → "Stanley Barros
 * Rodrigues"; "joão DE paula" → "João de Paula"; "ana-maria d'ávila" →
 * "Ana-Maria D'Ávila".
 */
export function capitalizeFullName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, index) =>
      index > 0 && NAME_PARTICLES.has(word)
        ? word
        : word.replace(
            /(^|[-'’])(\p{L})/gu,
            (_, before: string, letter: string) =>
              before + letter.toLocaleUpperCase("pt-BR"),
          ),
    )
    .join(" ");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

/** Open = not revoked and not expired. */
export function isInviteOpen(invite: EnrollmentInvite, now: Date): boolean {
  return !invite.revokedAt && invite.expiresAt > now;
}
