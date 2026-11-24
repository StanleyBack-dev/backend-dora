/**
 * A quote (cotação) of a purchase request: one supplier's prices for the
 * request's items, plus shipping and terms. Money in cents.
 */

/** How the supplier is paid (OTHER: the terms typed). */
export enum PaymentMethod {
  PIX = "PIX",
  CASH = "CASH",
  DEBIT_CARD = "DEBIT_CARD",
  CREDIT_CARD = "CREDIT_CARD",
  BOLETO = "BOLETO",
  BANK_TRANSFER = "BANK_TRANSFER",
  /** Faturado: the supplier bills it later. */
  INVOICE = "INVOICE",
  OTHER = "OTHER",
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.PIX]: "PIX",
  [PaymentMethod.CASH]: "Dinheiro",
  [PaymentMethod.DEBIT_CARD]: "Cartão de débito",
  [PaymentMethod.CREDIT_CARD]: "Cartão de crédito",
  [PaymentMethod.BOLETO]: "Boleto",
  [PaymentMethod.BANK_TRANSFER]: "Transferência (TED)",
  [PaymentMethod.INVOICE]: "Faturado",
  [PaymentMethod.OTHER]: "Outro",
};

/** The methods that may be split into installments. */
export const INSTALLMENT_METHODS: readonly PaymentMethod[] = [
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.BOLETO,
  PaymentMethod.INVOICE,
  PaymentMethod.OTHER,
];

export const MAX_INSTALLMENTS = 60;

/**
 * The total split in `count` installments: equal parts, the last one
 * taking the cents left over (R$ 100,00 in 3x: 33,33 + 33,33 + 33,34).
 */
export function installmentCents(totalCents: number, count: number): number[] {
  const part = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? totalCents - part * (count - 1) : part,
  );
}

/** Interest: up to 20% a month, in basis points (1,99% → 199). */
export const MAX_INTEREST_BP = 2000;

/**
 * The installments of a cash total: without interest, equal parts (the last
 * one taking the cents left); with a monthly rate, the Price table (equal
 * installments, compound interest), each rounded to the cent.
 */
export function installmentPlan(
  cashCents: number,
  count: number,
  interestRateBp: number | null,
): number[] {
  if (!interestRateBp) return installmentCents(cashCents, count);
  const rate = interestRateBp / 10_000;
  const payment = Math.round((cashCents * rate) / (1 - (1 + rate) ** -count));
  return Array.from({ length: count }, () => payment);
}

export type PurchaseQuoteItem = {
  requestItemId: string;
  /** null: the supplier doesn't have it (a partial quote). */
  unitPriceCents: number | null;
};

/** One of a quote's other charges (installation, fees…). */
export type QuoteCharge = { label: string; amountCents: number };

export type PurchaseQuote = {
  id: string;
  requestId: string;
  supplierId: string;
  /** Trade name, or the legal name. */
  supplierName: string;
  items: PurchaseQuoteItem[];
  shippingCents: number;
  /** Other charges (installation, fees…), each with its value. */
  charges: QuoteCharge[];
  /** The charges' sum, in cents. */
  chargesCents: number;
  /** A discount on the whole quote, in cents (worked out from the percent). */
  discountCents: number;
  /** The discount as a percent of items + shipping + charges, in basis
   *  points (5% → 500; null: a fixed value). */
  discountPercentBp: number | null;
  /** Monthly interest of the installments, in basis points (null: none). */
  interestRateBp: number | null;
  /** Days to deliver (null: not said). */
  deliveryDays: number | null;
  /** How it is paid (null: not said). */
  paymentMethod: PaymentMethod | null;
  /** Installments (2 to 60; null: paid at once). */
  installments: number | null;
  /** With OTHER: the terms typed. */
  paymentTerms: string | null;
  /** The last day the prices hold ("2026-12-01"; null: not said). */
  validUntil: string | null;
  notes: string | null;
  /** The supplier's document in the storage (null: none). */
  fileKey: string | null;
  fileIsPdf: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Below this many quotes, choosing one asks a justification. */
export const MIN_QUOTES = 3;

export const QUOTE_LIMITS = {
  maxPriceCents: 10_000_000_000,
  maxDeliveryDays: 365,
  paymentTerms: 120,
  chargeLabel: 60,
  maxCharges: 10,
  /** 100%. */
  maxDiscountBp: 10_000,
  notes: 500,
  justificationMin: 3,
  justificationMax: 300,
} as const;

/** Quantity × unit price, rounded to the cent. */
export const lineCents = (quantity: number, unitPriceCents: number) =>
  Math.round(quantity * unitPriceCents);

export type QuoteTotals = {
  /** The priced items. */
  itemsCents: number;
  /** Items + shipping + other charges − discount (paid at once). */
  cashCents: number;
  /** What is paid in the end: with interest, the installments' sum. */
  totalCents: number;
  /** The interest added by the installments (0: none). */
  interestCents: number;
  /** Every item priced. */
  complete: boolean;
};

/** A quote's totals, given the request's quantities by item id. */
export function quoteTotals(
  quote: Pick<
    PurchaseQuote,
    | "items"
    | "shippingCents"
    | "chargesCents"
    | "discountCents"
    | "installments"
    | "interestRateBp"
  >,
  quantities: ReadonlyMap<string, number>,
): QuoteTotals {
  let itemsCents = 0;
  let complete = true;
  for (const [requestItemId, quantity] of quantities) {
    const price = quote.items.find(
      (item) => item.requestItemId === requestItemId,
    )?.unitPriceCents;
    if (price === null || price === undefined) {
      complete = false;
      continue;
    }
    itemsCents += lineCents(quantity, price);
  }
  const cashCents = Math.max(
    0,
    itemsCents + quote.shippingCents + quote.chargesCents - quote.discountCents,
  );
  const totalCents =
    quote.installments && quote.interestRateBp
      ? installmentPlan(
          cashCents,
          quote.installments,
          quote.interestRateBp,
        ).reduce((sum, part) => sum + part, 0)
      : cashCents;
  return {
    itemsCents,
    cashCents,
    totalCents,
    interestCents: totalCents - cashCents,
    complete,
  };
}

/**
 * The cheapest complete quote(s) (ties share it); none when no quote prices
 * every item.
 */
export function cheapestQuoteIds(
  quotes: readonly (Pick<PurchaseQuote, "id"> & QuoteTotals)[],
): string[] {
  const complete = quotes.filter((quote) => quote.complete);
  if (complete.length === 0) return [];
  const lowest = Math.min(...complete.map((quote) => quote.totalCents));
  return complete
    .filter((quote) => quote.totalCents === lowest)
    .map((quote) => quote.id);
}

/**
 * Whether choosing this quote needs a justification: it isn't the cheapest
 * complete one, or there are fewer than MIN_QUOTES quotes.
 */
export function choiceNeedsJustification(
  quoteId: string,
  quotes: readonly (Pick<PurchaseQuote, "id"> & QuoteTotals)[],
): boolean {
  return (
    quotes.length < MIN_QUOTES || !cheapestQuoteIds(quotes).includes(quoteId)
  );
}
