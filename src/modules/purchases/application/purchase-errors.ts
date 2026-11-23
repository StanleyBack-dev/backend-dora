import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";

/** A request's form refused, with the reason shown to the user. */
export const requestInvalid = (reason: string) =>
  AppException.from(APP_ERRORS.purchases.requestInvalid, { reason });

/** A quote's form refused, with the reason shown to the user. */
export const quoteInvalid = (reason: string) =>
  AppException.from(APP_ERRORS.purchases.quoteInvalid, { reason });

/** An order, delivery, payment or rating refused, with the reason. */
export const orderInvalid = (reason: string) =>
  AppException.from(APP_ERRORS.purchases.orderInvalid, { reason });

/** The caller lacks the permission the action needs. */
export const missingPermission = () =>
  AppException.from(APP_ERRORS.accessControl.missingPermission, undefined);

/**
 * A free text trimmed with single spaces (null when blank); longer than
 * `max`, the error built by `tooLong` is thrown.
 */
export function boundedText(
  value: string | null | undefined,
  max: number,
  tooLong: () => AppException,
): string | null {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (text.length > max) throw tooLong();
  return text || null;
}
