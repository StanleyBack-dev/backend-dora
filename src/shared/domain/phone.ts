/** Digits only; accepts Brazilian landlines (10) and mobiles (11), "+55" too. */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return /^\d{10,11}$/.test(digits) ? digits : null;
}

/** "(11) 98765-4321" or "(11) 3456-7890" from the digits. */
export const formatPhone = (digits: string) =>
  digits.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
