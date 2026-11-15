// Brazilian identity documents a person may show: CPF (national, with check
// digits) or RG (issued by each state; no single rule for its digits, so
// only the shape is checked).

export enum DocumentType {
  CPF = "CPF",
  RG = "RG",
}

/** CPF digits (11) when the check digits match; null otherwise. */
export function normalizeCpf(value: string): string | null {
  // Only digits and the mask's punctuation: letters are refused.
  if (/[^0-9.\-\s]/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits)) return null;
  // 000.000.000-00, 111.111.111-11…: right digits, never issued.
  if (/^(\d)\1{10}$/.test(digits)) return null;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10])
    ? digits
    : null;
}

/** Shortest and longest RG (digits, the last one may be "X"). */
export const RG_MIN = 7;
export const RG_MAX = 10;

/**
 * RG as stored: digits only, the last one may be "X" (SP and other states);
 * 7 to 10 characters. null when it doesn't look like an RG.
 */
export function normalizeRg(value: string): string | null {
  // Only digits, "X" and the mask's punctuation: a letter is refused, not
  // silently dropped.
  if (/[^0-9xX.\-\s]/.test(value)) return null;
  const rg = value.toUpperCase().replace(/[^0-9X]/g, "");
  const pattern = new RegExp(`^\\d{${RG_MIN - 1},${RG_MAX - 1}}[\\dX]$`);
  return pattern.test(rg) ? rg : null;
}

/** The document in its usual shape: "123.456.789-09", "12.345.678-9". */
export function formatDocument(type: DocumentType, value: string): string {
  if (type === DocumentType.CPF) {
    return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  const body = value.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${value.slice(-1)}`;
}
