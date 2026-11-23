/** Plurals that the rules below don't give. */
const IRREGULAR: Record<string, string> = { mês: "meses", par: "pares" };

/**
 * A unit typed for an item, in the plural when the quantity asks for it
 * ("4 rolos", "2 galões", "3 meses"). Abbreviations ("un", "cx", "kg",
 * "L", "m²") and anything not a plain lowercase word stay as typed.
 */
export function unitFor(quantity: number, unit: string): string {
  if (quantity > 0 && quantity <= 1) return unit;
  if (IRREGULAR[unit]) return IRREGULAR[unit];
  if (unit.length <= 3 || !/^[a-zà-ú]+$/.test(unit)) return unit;
  if (unit.endsWith("ão")) return `${unit.slice(0, -2)}ões`;
  if (/[aeiouéêó]$/.test(unit)) return `${unit}s`;
  if (/[rz]$/.test(unit)) return `${unit}es`;
  if (unit.endsWith("l")) return `${unit.slice(0, -1)}is`;
  return unit;
}

/** "4 rolos", "1,5 kg". */
export const formatQuantity = (quantity: number, unit: string) =>
  `${quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unitFor(quantity, unit)}`;
