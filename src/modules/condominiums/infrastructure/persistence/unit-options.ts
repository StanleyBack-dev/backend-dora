import { unitLabel } from "@/modules/condominiums/domain/unit";

/** A unit row read for a filter (tb_units, read-only). */
export type UnitRow = {
  id: string;
  street: string | null;
  block: string | null;
  number: string;
};

/** The units of a filter, labelled and in the natural order (A 2 < A 10). */
export const toUnitOptions = (
  rows: UnitRow[],
): { id: string; label: string }[] =>
  rows
    .map((row) => ({
      id: row.id,
      label: unitLabel({
        street: row.street,
        block: row.block ?? "",
        number: row.number,
      }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
