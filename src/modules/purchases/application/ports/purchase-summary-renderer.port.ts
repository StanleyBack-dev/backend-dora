/** The purchase summary (resumo da compra), already worked out as text. */
export type PurchaseSummaryInput = {
  /** "SC-0007". */
  code: string;
  title: string;
  condominiumName: string;
  /** "22/11/2026 14:30". */
  generatedAt: string;
  /** Where the purchase stands ("Aprovada", "Aguardando aprovação"…). */
  statusLabel: string;
  status: { tone: "good" | "bad" | "waiting" | "info"; line: string };
  /** The request as label/value rows (who asked, when, by when…). */
  facts: [string, string | null][];
  details: string | null;
  items: { label: string; quantity: string }[];
  /** Each quote in one line, the cheapest complete first. */
  quotes: { supplier: string; line: string }[];
  /** The chosen quote (null: none chosen). */
  choice: {
    supplier: string;
    facts: [string, string | null][];
  } | null;
  /** What happened, oldest first. */
  timeline: { at: string; event: string }[];
  signers: { name: string; role: string }[];
};

export interface PurchaseSummaryRendererPort {
  render(input: PurchaseSummaryInput): Promise<Buffer>;
}

export const PURCHASE_SUMMARY_RENDERER = Symbol("PURCHASE_SUMMARY_RENDERER");
