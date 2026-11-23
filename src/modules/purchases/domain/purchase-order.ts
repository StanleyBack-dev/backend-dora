import type { PaymentMethod } from "@/modules/purchases/domain/purchase-quote";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import { addDays, isLocalDate } from "@/shared/domain/local-date";

/**
 * After the approval: the purchase order (ordem de compra) sent to the
 * supplier, the deliveries (a delivery may bring part of the items) and the
 * payment, installment by installment. Received in full and paid in full,
 * the purchase is completed and the supplier may be rated. Money in cents.
 */

/** A delivery: what arrived of each item, and its invoice. */
export type PurchaseReceipt = {
  id: string;
  orderId: string;
  /** The local day it arrived ("2026-12-01"). */
  receivedOn: string;
  /** What arrived, by the request's item id. */
  items: { requestItemId: string; quantity: number }[];
  /** Nota fiscal (null: not given). */
  invoiceNumber: string | null;
  invoiceCents: number | null;
  invoiceDate: string | null;
  /** The invoice's file in the storage (null: none). */
  fileKey: string | null;
  fileIsPdf: boolean | null;
  note: string | null;
  receivedById: string | null;
  receivedByName: string | null;
  createdAt: Date;
};

/** What is paid to the supplier: one installment (or the whole). */
export type PurchaseInstallment = {
  id: string;
  orderId: string;
  /** 1, 2, 3… */
  number: number;
  amountCents: number;
  dueOn: string;
  /** null: not paid yet. */
  paidOn: string | null;
  paidById: string | null;
  paidByName: string | null;
  /** The proof of payment in the storage (null: none). */
  proofKey: string | null;
  proofIsPdf: boolean | null;
  note: string | null;
};

/** The supplier's rating once the purchase is completed. */
export type PurchaseOrderRating = {
  rating: number;
  comment: string | null;
  ratedByName: string | null;
  ratedAt: Date;
};

export type PurchaseOrder = {
  id: string;
  condominiumId: string;
  requestId: string;
  quoteId: string | null;
  /** null: the supplier was removed. */
  supplierId: string | null;
  /** Sequential in the condominium (shown as "OC-0001"). */
  number: number;
  supplierName: string;
  /** The items as quoted. */
  itemsCents: number;
  /** What is paid in the end (the installments' sum). */
  totalCents: number;
  paymentMethod: PaymentMethod | null;
  paymentTerms: string | null;
  /** The day the delivery is expected (null: not said). */
  expectedOn: string | null;
  notes: string | null;
  orderedById: string | null;
  orderedByName: string | null;
  orderedAt: Date;
  /** Received and paid in full (null: not yet). */
  completedAt: Date | null;
  receipts: PurchaseReceipt[];
  installments: PurchaseInstallment[];
  rating: PurchaseOrderRating | null;
};

/** An order cancelled before anything arrived or was paid. */
export type CancelledPurchaseOrder = {
  number: number;
  supplierName: string;
  totalCents: number;
  orderedAt: Date;
  cancelledAt: Date;
  cancelledByName: string | null;
  reason: string;
};

export const ORDER_LIMITS = {
  notes: 500,
  receiptNote: 300,
  invoiceNumber: 40,
  paymentNote: 300,
  ratingComment: 300,
  cancelReason: 300,
  maxInvoiceCents: 10_000_000_000,
  /** How far ahead a due day or the expected delivery may be. */
  maxDaysAhead: 3 * 366,
} as const;

/** Where a supplier's rating comes from (tb_supplier_ratings.source). */
export const ORDER_RATING_SOURCE = "PURCHASE_ORDER";

/** Which installments the payments page lists. */
export enum InstallmentState {
  /** Not paid, due today or later. */
  OPEN = "OPEN",
  /** Not paid, past the due day. */
  OVERDUE = "OVERDUE",
  /** Not paid, due in the next 7 days. */
  DUE_SOON = "DUE_SOON",
  PAID = "PAID",
}

/** "OC-0007". */
export const orderCode = (number: number) =>
  `OC-${String(number).padStart(4, "0")}`;

/** Quantities are kept with two decimals. */
export const roundQuantity = (value: number) => Math.round(value * 100) / 100;

/** What has arrived of each item, by the request's item id. */
export function receivedByItem(
  receipts: readonly Pick<PurchaseReceipt, "items">[],
): Map<string, number> {
  const received = new Map<string, number>();
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      received.set(
        item.requestItemId,
        roundQuantity((received.get(item.requestItemId) ?? 0) + item.quantity),
      );
    }
  }
  return received;
}

/** What is still to arrive of each item (0: all of it arrived). */
export function pendingByItem(
  items: readonly { id: string; quantity: number }[],
  receipts: readonly Pick<PurchaseReceipt, "items">[],
): Map<string, number> {
  const received = receivedByItem(receipts);
  return new Map(
    items.map((item) => [
      item.id,
      Math.max(0, roundQuantity(item.quantity - (received.get(item.id) ?? 0))),
    ]),
  );
}

/** Every item arrived in full. */
export const fullyReceived = (
  items: readonly { id: string; quantity: number }[],
  receipts: readonly Pick<PurchaseReceipt, "items">[],
) => [...pendingByItem(items, receipts).values()].every((left) => left === 0);

/** Every installment paid. */
export const fullyPaid = (
  installments: readonly Pick<PurchaseInstallment, "paidOn">[],
) => installments.every((installment) => installment.paidOn !== null);

/**
 * The request's status from how the order stands: completed once received
 * and paid in full; received once everything arrived; otherwise ordered.
 */
export function orderStatus(received: boolean, paid: boolean) {
  if (received && paid) return PurchaseRequestStatus.COMPLETED;
  if (received) return PurchaseRequestStatus.RECEIVED;
  return PurchaseRequestStatus.ORDERED;
}

/** The statuses of a request with an order. */
export const ORDER_STATUSES: readonly PurchaseRequestStatus[] = [
  PurchaseRequestStatus.ORDERED,
  PurchaseRequestStatus.RECEIVED,
  PurchaseRequestStatus.COMPLETED,
];

/**
 * The due days of `count` monthly installments from the first one, keeping
 * its day of the month (the 31st falls on the month's last day).
 */
export function monthlyDueDays(first: string, count: number): string[] {
  const [year, month, day] = first.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const months = month - 1 + index;
    const y = year + Math.floor(months / 12);
    const m = (months % 12) + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const d = Math.min(day, last);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
}

/** A local day ("2026-12-01") within reach: not before `from`, not too far. */
export function dayInRange(day: string, from: string, today: string) {
  return (
    isLocalDate(day) &&
    day >= from &&
    day <= addDays(today, ORDER_LIMITS.maxDaysAhead)
  );
}
