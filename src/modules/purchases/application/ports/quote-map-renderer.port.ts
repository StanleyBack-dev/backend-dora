import type { ApprovalDecision } from "@/modules/purchases/domain/purchase-approval";

/** What the comparison map (mapa de cotação) shows, already worked out. */
export type QuoteMapInput = {
  /** "SC-0007". */
  code: string;
  title: string;
  condominiumName: string;
  requestedByName: string;
  /** "05/12/2026" (null: no date). */
  neededBy: string | null;
  /** Where it will be used (null: not said). */
  location: string | null;
  /** When it was generated ("21/11/2026 14:30"). */
  generatedAt: string;
  items: { label: string; quantity: string }[];
  quotes: {
    supplierName: string;
    /** Unit price and line total per item, in the items' order (null: not quoted). */
    lines: { unitCents: number | null; lineCents: number | null }[];
    itemsCents: number;
    shippingCents: number;
    charges: { label: string; amountCents: number }[];
    discountCents: number;
    /** The discount's percent, in basis points (null: a fixed value). */
    discountPercentBp: number | null;
    /** Monthly interest, in basis points (null: none). */
    interestRateBp: number | null;
    /** Paid at once. */
    cashCents: number;
    interestCents: number;
    /** What is paid in the end. */
    totalCents: number;
    complete: boolean;
    cheapest: boolean;
    chosen: boolean;
    deliveryDays: number | null;
    /** How it is paid, as a line ("Cartão de crédito · 3x de R$ 56,60"). */
    payment: string | null;
    validUntil: string | null;
    notes: string | null;
    /** The supplier's document is attached ("PDF", "Imagem"; null: none). */
    file: string | null;
  }[];
  /** Why the chosen quote (null: none chosen or no justification). */
  justification: string | null;
  /** Who chose it (null: not chosen). */
  chosenByName: string | null;
  /** The approval decision that stands (null: none yet). */
  decision: {
    kind: ApprovalDecision;
    byName: string | null;
    /** "22/11/2026 14:30". */
    at: string;
    note: string | null;
    /** The limit in force (null: every purchase waited). */
    limitCents: number | null;
  } | null;
};

export interface QuoteMapRendererPort {
  /** The map as a PDF. */
  render(input: QuoteMapInput): Promise<Buffer>;
}

export const QUOTE_MAP_RENDERER = Symbol("QUOTE_MAP_RENDERER");
