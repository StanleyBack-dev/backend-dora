/** Digits only; accepts Brazilian landlines (10) and mobiles (11), "+55" too. */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return /^\d{10,11}$/.test(digits) ? digits : null;
}
