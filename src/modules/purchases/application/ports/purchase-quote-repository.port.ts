import type {
  PaymentMethod,
  PurchaseQuote,
  PurchaseQuoteItem,
  QuoteCharge,
} from "@/modules/purchases/domain/purchase-quote";

/** A quote's form, already checked (the file already stored). */
export type PurchaseQuoteData = {
  items: PurchaseQuoteItem[];
  shippingCents: number;
  charges: QuoteCharge[];
  chargesCents: number;
  discountCents: number;
  discountPercentBp: number | null;
  interestRateBp: number | null;
  deliveryDays: number | null;
  paymentMethod: PaymentMethod | null;
  installments: number | null;
  paymentTerms: string | null;
  validUntil: string | null;
  notes: string | null;
  fileKey: string | null;
  fileIsPdf: boolean | null;
};

export interface PurchaseQuoteRepositoryPort {
  /** The request's quotes, oldest first. */
  listFor(requestId: string): Promise<PurchaseQuote[]>;
  /** A quote of a request of the condominium (null: none). */
  find(condominiumId: string, id: string): Promise<PurchaseQuote | null>;
  /**
   * Adds a quote while the request waits for or is in quotes (the first
   * one moves it to QUOTING). null: the request is past that; nothing is
   * written.
   */
  create(
    requestId: string,
    supplierId: string,
    data: PurchaseQuoteData,
  ): Promise<PurchaseQuote | null>;
  /** Replaces a quote's prices and terms while the request is in quotes. */
  update(id: string, data: PurchaseQuoteData): Promise<PurchaseQuote | null>;
  /**
   * Removes a quote while the request is in quotes (the last one moves it
   * back to OPEN). Returns its file key (to delete), or undefined when the
   * request is past quoting (nothing removed).
   */
  remove(id: string): Promise<string | null | undefined>;
  /**
   * Chooses the quote: the request leaves QUOTING for AWAITING_APPROVAL
   * (false: it wasn't in quotes; nothing is written).
   */
  choose(
    requestId: string,
    quoteId: string,
    justification: string | null,
    chosenBy: string,
    at: Date,
  ): Promise<boolean>;
  /**
   * Undoes the choice while waiting for the approval: back to QUOTING
   * (false: it wasn't waiting; nothing is written).
   */
  reopen(requestId: string): Promise<boolean>;
}

export const PURCHASE_QUOTE_REPOSITORY = Symbol("PURCHASE_QUOTE_REPOSITORY");
