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
  normalizeStreet,
  normalizeUnitComplement,
  normalizeUnitNumber,
} from "@/modules/condominiums/domain/unit";
import { normalizeEmail } from "@/modules/identity/domain/username";
import { normalizeBirthDate } from "@/shared/domain/birth-date";

/** What the public form sends (raw, validated here). */
export type EnrollmentInput = {
  fullName: string;
  email: string;
  phone: string;
  /** YYYY-MM-DD (required on the public form). */
  birthDate?: string | null;
  unitId?: string | null;
  /** Address detail inside the condominium ("casa dos fundos"). */
  unitComplement?: string | null;
  /** Typed when the condominium has no units registered yet. */
  unitBlock?: string | null;
  unitNumber?: string | null;
  /** Houses: the street (with the quadra as block and the lote as number). */
  unitStreet?: string | null;
};

/** Where the person lives in the condominium, as typed on a form. */
export type EnrollmentPlace = {
  unitComplement: string | null;
  typedUnitStreet: string | null;
  typedUnitBlock: string | null;
  typedUnitNumber: string | null;
};

/**
 * Checks the address fields. The typed place is kept only when `typed`
 * (the condominium has no units to choose from); otherwise the unit comes
 * from the list. Houses (`house`) need the street, the quadra and the
 * lote; apartments the number (and the block, if any).
 */
export function validatePlace(
  input: EnrollmentInput,
  typed: boolean,
  house = false,
): EnrollmentPlace {
  const error = (key: keyof typeof APP_ERRORS.enrollment) =>
    AppException.from(APP_ERRORS.enrollment[key], undefined);

  const unitComplement = normalizeUnitComplement(input.unitComplement);
  if (unitComplement === "too-long") throw error("invalidComplement");
  if (!typed) {
    return {
      unitComplement,
      typedUnitStreet: null,
      typedUnitBlock: null,
      typedUnitNumber: null,
    };
  }
  if (house) {
    const street = normalizeStreet(input.unitStreet);
    const quadra = normalizeBlock(input.unitBlock);
    const lote = normalizeUnitNumber(input.unitNumber ?? "");
    if (!street || !quadra || !lote) throw error("invalidTypedHouse");
    return {
      unitComplement,
      typedUnitStreet: street,
      typedUnitBlock: quadra,
      typedUnitNumber: lote,
    };
  }
  const typedUnitBlock = normalizeBlock(input.unitBlock);
  if (typedUnitBlock === null) throw error("invalidTypedUnit");
  const typedUnitNumber = normalizeUnitNumber(input.unitNumber ?? "");
  if (!typedUnitNumber) throw error("invalidTypedUnit");
  return {
    unitComplement,
    typedUnitStreet: null,
    typedUnitBlock: typedUnitBlock || null,
    typedUnitNumber,
  };
}

/**
 * Checks and normalizes the form. Shared by the public submission and the
 * manager's corrections (`today`: YYYY-MM-DD; the birth date is required
 * on the public form, optional when a manager approves an older request).
 */
export function validateEnrollment(
  input: EnrollmentInput,
  today: string,
  birthDateRequired = true,
): Pick<EnrollmentData, "fullName" | "email" | "phone" | "birthDate"> {
  const error = (key: keyof typeof APP_ERRORS.enrollment) =>
    AppException.from(APP_ERRORS.enrollment[key], undefined);

  const fullName = normalizeFullName(input.fullName);
  if (!fullName) throw error("invalidName");

  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw error("invalidEmail");

  const phone = normalizePhone(input.phone);
  if (!phone) throw error("invalidPhone");

  const typedBirth = input.birthDate?.trim() ?? "";
  const birthDate = typedBirth ? normalizeBirthDate(typedBirth, today) : null;
  if ((typedBirth && !birthDate) || (!birthDate && birthDateRequired)) {
    throw error("invalidBirthDate");
  }

  return { fullName, email, phone, birthDate };
}
