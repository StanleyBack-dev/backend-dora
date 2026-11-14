import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  isValidEmail,
  normalizeFullName,
  normalizePhone,
  type EnrollmentData,
} from "@/modules/enrollment/domain/enrollment";
import {
  normalizeBlock,
  normalizeUnitComplement,
  normalizeUnitNumber,
} from "@/modules/condominiums/domain/unit";
import { normalizeEmail } from "@/modules/identity/domain/username";

/** What the public form sends (raw, validated here). */
export type EnrollmentInput = {
  fullName: string;
  email: string;
  phone: string;
  unitId?: string | null;
  /** Address detail inside the condominium ("casa dos fundos"). */
  unitComplement?: string | null;
  /** Typed when the condominium has no units registered yet. */
  unitBlock?: string | null;
  unitNumber?: string | null;
};

/** Where the person lives in the condominium, as typed on a form. */
export type EnrollmentPlace = {
  unitComplement: string | null;
  typedUnitBlock: string | null;
  typedUnitNumber: string | null;
};

/**
 * Checks the address fields. The typed block/number are kept only when
 * `typed` (the condominium has no units to choose from); otherwise the
 * unit comes from the list.
 */
export function validatePlace(
  input: EnrollmentInput,
  typed: boolean,
): EnrollmentPlace {
  const error = (key: keyof typeof APP_ERRORS.enrollment) =>
    AppException.from(APP_ERRORS.enrollment[key], undefined);

  const unitComplement = normalizeUnitComplement(input.unitComplement);
  if (unitComplement === "too-long") throw error("invalidComplement");
  if (!typed) {
    return { unitComplement, typedUnitBlock: null, typedUnitNumber: null };
  }
  const typedUnitBlock = normalizeBlock(input.unitBlock);
  if (typedUnitBlock === null) throw error("invalidTypedUnit");
  const typedUnitNumber = normalizeUnitNumber(input.unitNumber ?? "");
  if (!typedUnitNumber) throw error("invalidTypedUnit");
  return {
    unitComplement,
    typedUnitBlock: typedUnitBlock || null,
    typedUnitNumber,
  };
}

/**
 * Checks and normalizes the form. Shared by the public submission and the
 * manager's corrections.
 */
export function validateEnrollment(
  input: EnrollmentInput,
): Pick<EnrollmentData, "fullName" | "email" | "phone"> {
  const error = (key: keyof typeof APP_ERRORS.enrollment) =>
    AppException.from(APP_ERRORS.enrollment[key], undefined);

  const fullName = normalizeFullName(input.fullName);
  if (!fullName) throw error("invalidName");

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw error("invalidEmail");

  const phone = normalizePhone(input.phone);
  if (!phone) throw error("invalidPhone");

  return { fullName, email, phone };
}
