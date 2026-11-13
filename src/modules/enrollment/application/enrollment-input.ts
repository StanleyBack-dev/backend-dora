import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  isValidEmail,
  normalizeFullName,
  normalizePhone,
  type EnrollmentData,
} from "@/modules/enrollment/domain/enrollment";
import { normalizeEmail } from "@/modules/identity/domain/username";

/** What the public form sends (raw, validated here). */
export type EnrollmentInput = {
  fullName: string;
  email: string;
  phone: string;
  unitId?: string | null;
};

/**
 * Checks and normalizes the form. Shared by the public submission and the
 * manager's corrections.
 */
export function validateEnrollment(
  input: EnrollmentInput,
): Omit<EnrollmentData, "unitId"> {
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
