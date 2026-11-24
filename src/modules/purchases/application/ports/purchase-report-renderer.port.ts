/** A column of a report table: its share of the width and alignment. */
export type ReportColumn = {
  label: string;
  width: number;
  align?: "left" | "right";
};

/** A cell: text, or a bar (share 0–1) with its label. */
export type ReportCell = string | { bar: number; label: string };

export type ReportTable = {
  title: string;
  columns: ReportColumn[];
  rows: ReportCell[][];
  /** Under the table (e.g. how categories are split). */
  note?: string;
};

/** A purchases report (indicators or accounts), already worked out as text. */
export type PurchaseReportInput = {
  /** The header's label ("Indicadores de compras"). */
  label: string;
  title: string;
  condominiumName: string;
  /** "Ano de 2026", "Novembro de 2026". */
  period: string;
  /** "23/11/2026 14:30". */
  generatedAt: string;
  stats: { label: string; value: string; hint?: string }[];
  /** Label/value rows (e.g. the process figures). */
  facts: { title: string; rows: [string, string][] } | null;
  tables: ReportTable[];
};

export interface PurchaseReportRendererPort {
  render(input: PurchaseReportInput): Promise<Buffer>;
}

export const PURCHASE_REPORT_RENDERER = Symbol("PURCHASE_REPORT_RENDERER");
