import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  INSTALLMENT_METHODS,
  lineCents,
  MAX_INSTALLMENTS,
  MAX_INTEREST_BP,
  PaymentMethod,
  type PurchaseQuoteItem,
  type QuoteCharge,
  QUOTE_LIMITS as LIMITS,
} from "@/modules/purchases/domain/purchase-quote";
import { requestText } from "@/modules/purchases/domain/purchase-request";
import { isLocalDate } from "@/shared/domain/local-date";

/** A quote's prices and terms as sent (the file goes apart). */
export type PurchaseQuoteInput = {
  items: { requestItemId: string; unitPriceCents?: number | null }[];
  shippingCents?: number | null;
  charges?: { label: string; amountCents: number }[] | null;
  /** A fixed discount (ignored with a percent). */
  discountCents?: number | null;
  /** The discount as a percent of the quote, in basis points. */
  discountPercentBp?: number | null;
  /** Monthly interest of the installments, in basis points. */
  interestRateBp?: number | null;
  deliveryDays?: number | null;
  paymentMethod?: PaymentMethod | null;
  installments?: number | null;
  /** With OTHER: the terms typed. */
  paymentTerms?: string | null;
  validUntil?: string | null;
  notes?: string | null;
};

export type PurchaseQuoteTerms = {
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
};

const invalid = (reason: string) =>
  AppException.from(APP_ERRORS.purchases.quoteInvalid, { reason });

const cents = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= LIMITS.maxPriceCents;

/**
 * Validates a quote against its request's items: each item once (priced,
 * or null when the supplier doesn't have it), at least one priced.
 */
export function validateQuoteInput(
  input: PurchaseQuoteInput,
  requestItems: readonly { id: string; quantity: number }[],
): PurchaseQuoteTerms {
  const requestItemIds = requestItems.map((item) => item.id);
  const byItem = new Map<string, number | null>();
  for (const item of input.items ?? []) {
    if (!requestItemIds.includes(item.requestItemId)) {
      throw invalid("Um dos itens não é desta solicitação.");
    }
    if (byItem.has(item.requestItemId)) {
      throw invalid("Cada item da solicitação entra uma vez na cotação.");
    }
    const price = item.unitPriceCents ?? null;
    if (price !== null && !cents(price)) {
      throw invalid("Confira os preços: em reais, maiores ou iguais a zero.");
    }
    byItem.set(item.requestItemId, price);
  }
  const items = requestItemIds.map((requestItemId) => ({
    requestItemId,
    unitPriceCents: byItem.get(requestItemId) ?? null,
  }));
  if (items.every((item) => item.unitPriceCents === null)) {
    throw invalid("Informe o preço de ao menos um item.");
  }

  const shippingCents = input.shippingCents ?? 0;
  if (!cents(shippingCents)) throw invalid("Confira o valor do frete.");
  const charges = (input.charges ?? []).map((charge) => {
    const label = requestText(charge.label, LIMITS.chargeLabel);
    if (!label || label.length < 2) {
      throw invalid(
        `Diga o que é cada encargo (de 2 a ${LIMITS.chargeLabel} caracteres).`,
      );
    }
    if (!cents(charge.amountCents) || charge.amountCents === 0) {
      throw invalid("Informe o valor de cada encargo.");
    }
    return { label, amountCents: charge.amountCents };
  });
  if (charges.length > LIMITS.maxCharges) {
    throw invalid(`Até ${LIMITS.maxCharges} encargos por cotação.`);
  }
  const chargesCents = charges.reduce(
    (sum, charge) => sum + charge.amountCents,
    0,
  );
  if (!cents(chargesCents)) throw invalid("Confira o valor dos encargos.");
  const discountPercentBp = input.discountPercentBp || null;
  if (
    discountPercentBp !== null &&
    (!Number.isInteger(discountPercentBp) ||
      discountPercentBp < 1 ||
      discountPercentBp > LIMITS.maxDiscountBp)
  ) {
    throw invalid("O desconto vai de 0,01% a 100%.");
  }
  const grossCents =
    items.reduce((sum, item) => {
      const quantity =
        requestItems.find((each) => each.id === item.requestItemId)?.quantity ??
        0;
      return item.unitPriceCents === null
        ? sum
        : sum + lineCents(quantity, item.unitPriceCents);
    }, 0) +
    shippingCents +
    chargesCents;
  // A percent is worked out on items + shipping + charges.
  const discountCents =
    discountPercentBp !== null
      ? Math.round((grossCents * discountPercentBp) / 10_000)
      : (input.discountCents ?? 0);
  if (!cents(discountCents)) throw invalid("Confira o valor do desconto.");
  if (discountCents > grossCents) {
    throw invalid("O desconto não pode passar do valor da cotação.");
  }
  const deliveryDays = input.deliveryDays ?? null;
  if (
    deliveryDays !== null &&
    (!Number.isInteger(deliveryDays) ||
      deliveryDays < 0 ||
      deliveryDays > LIMITS.maxDeliveryDays)
  ) {
    throw invalid(
      `O prazo de entrega vai de 0 a ${LIMITS.maxDeliveryDays} dias.`,
    );
  }
  const paymentMethod = input.paymentMethod ?? null;
  if (
    paymentMethod !== null &&
    !Object.values(PaymentMethod).includes(paymentMethod)
  ) {
    throw invalid("Escolha a forma de pagamento.");
  }
  // "Outro": the terms typed; the listed methods carry no text.
  let paymentTerms: string | null = null;
  if (paymentMethod === PaymentMethod.OTHER) {
    paymentTerms = requestText(input.paymentTerms, LIMITS.paymentTerms) ?? null;
    if (!paymentTerms || paymentTerms.length < 2) {
      throw invalid(
        `Descreva a forma de pagamento (de 2 a ${LIMITS.paymentTerms} caracteres).`,
      );
    }
  }
  const installments =
    input.installments === null ||
    input.installments === undefined ||
    input.installments === 1
      ? null
      : input.installments;
  if (installments !== null) {
    if (
      paymentMethod === null ||
      !INSTALLMENT_METHODS.includes(paymentMethod)
    ) {
      throw invalid(
        "Parcelamento só para cartão de crédito, boleto, faturado ou outro.",
      );
    }
    if (
      !Number.isInteger(installments) ||
      installments < 2 ||
      installments > MAX_INSTALLMENTS
    ) {
      throw invalid(`O parcelamento vai de 2 a ${MAX_INSTALLMENTS} vezes.`);
    }
  }
  const interestRateBp = input.interestRateBp || null;
  if (interestRateBp !== null) {
    if (installments === null) {
      throw invalid("Juros só no pagamento parcelado.");
    }
    if (
      !Number.isInteger(interestRateBp) ||
      interestRateBp < 1 ||
      interestRateBp > MAX_INTEREST_BP
    ) {
      throw invalid("Os juros vão de 0,01% a 20% ao mês.");
    }
  }
  const notes = requestText(input.notes, LIMITS.notes);
  if (notes === undefined) {
    throw invalid(`As observações têm até ${LIMITS.notes} caracteres.`);
  }
  const validUntil = input.validUntil?.trim() || null;
  if (validUntil !== null && !isLocalDate(validUntil)) {
    throw invalid("Confira a data de validade.");
  }
  return {
    items,
    shippingCents,
    charges,
    chargesCents,
    discountCents,
    discountPercentBp,
    interestRateBp,
    deliveryDays,
    paymentMethod,
    installments,
    paymentTerms,
    validUntil,
    notes,
  };
}

/** A justification: 3 to 300 characters (null: none given). */
export function normalizeJustification(
  value: string | null | undefined,
): string | null {
  const text = requestText(value, LIMITS.justificationMax);
  if (text === undefined) {
    throw invalid(
      `A justificativa tem até ${LIMITS.justificationMax} caracteres.`,
    );
  }
  if (text !== null && text.length < LIMITS.justificationMin) {
    throw invalid(
      `A justificativa tem ao menos ${LIMITS.justificationMin} caracteres.`,
    );
  }
  return text;
}
