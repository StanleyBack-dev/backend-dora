/** The purchase order (ordem de compra), already worked out as text. */
export type PurchaseOrderInput = {
  /** "OC-0003". */
  code: string;
  /** "SC-0007 · Lâmpadas do hall". */
  request: string;
  condominium: { name: string; facts: [string, string | null][] };
  /** "22/11/2026 14:30". */
  generatedAt: string;
  supplier: { name: string; facts: [string, string | null][] };
  /** Where and when to deliver. */
  delivery: [string, string | null][];
  /** One row per item: "1. Lâmpada · Qualquer marca", "10 un × R$ 12,90 = R$ 129,00". */
  items: [string, string][];
  /** Items, shipping, charges, discount, interest and the total. */
  totals: [string, string][];
  /** How it is paid and each installment with its due day. */
  payment: [string, string | null][];
  notes: string | null;
  signers: { name: string; role: string }[];
};

export interface PurchaseOrderRendererPort {
  render(input: PurchaseOrderInput): Promise<Buffer>;
}

export const PURCHASE_ORDER_RENDERER = Symbol("PURCHASE_ORDER_RENDERER");
