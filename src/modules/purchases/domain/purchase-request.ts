import type { Category } from "@/modules/catalog/domain/category";

// A purchase request (solicitação de compra): what someone of the team
// (gate, caretaker, management) needs bought or contracted, with its items.
// It goes through quotes and the síndico's approval up to the delivery;
// the statuses after OPEN arrive with the next phases of the module.

export enum PurchaseRequestStatus {
  /** Waiting for quotes. */
  OPEN = "OPEN",
  /** Quotes being collected. */
  QUOTING = "QUOTING",
  /** A quote was chosen; waiting for the approval. */
  AWAITING_APPROVAL = "AWAITING_APPROVAL",
  APPROVED = "APPROVED",
  /** The purchase order was sent to the supplier. */
  ORDERED = "ORDERED",
  /** Delivered (or the service done). */
  RECEIVED = "RECEIVED",
  /** Delivered and paid. */
  COMPLETED = "COMPLETED",
  /** Not approved. */
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

/**
 * Still waiting on someone (quotes or the approval): what the Solicitações
 * list shows by default, so its cards count the same requests.
 */
export const PENDING_REQUEST_STATUSES: readonly PurchaseRequestStatus[] = [
  PurchaseRequestStatus.OPEN,
  PurchaseRequestStatus.QUOTING,
  PurchaseRequestStatus.AWAITING_APPROVAL,
];

/** Edited (and cancelled) only before the quotes start. */
export const isEditableRequest = (status: PurchaseRequestStatus) =>
  status === PurchaseRequestStatus.OPEN;

/**
 * In quotes, only what doesn't change what is quoted may still change: the
 * place, the date and the priority (the title, the details, the items and
 * the categories stay, since the quotes were made on them).
 */
export const isDetailsEditableRequest = (status: PurchaseRequestStatus) =>
  status === PurchaseRequestStatus.OPEN ||
  status === PurchaseRequestStatus.QUOTING;

export enum PurchasePriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export type PurchaseRequestItem = {
  id: string;
  /** A product of the condominium's catalog. */
  productId: string;
  productName: string;
  /** Up to two decimals (e.g. 2.5 kg). */
  quantity: number;
  /** "un", "cx", "kg", "m²", "serviço"… */
  unit: string;
  /** The brand asked for (null: any brand). */
  brandId: string | null;
  brandName: string | null;
  /** What else identifies it (color, size, model…; null: nothing). */
  note: string | null;
};

export type PurchaseRequest = {
  id: string;
  condominiumId: string;
  /** Sequential in the condominium (shown as "SC-0001"). */
  number: number;
  title: string;
  description: string | null;
  categories: Category[];
  /** With OTHER among them: what it is about, typed (null otherwise). */
  categoryOther: string | null;
  priority: PurchasePriority;
  /**
   * A space of the condominium where it will be used (null: another place
   * or not said).
   */
  spaceId: string | null;
  /** Where it will be used: the space's name, or the place typed. */
  location: string | null;
  /** The local day it is needed by ("2026-12-01"; null: no date). */
  neededBy: string | null;
  status: PurchaseRequestStatus;
  requestedById: string;
  requestedByName: string;
  items: PurchaseRequestItem[];
  /** How many quotes it has. */
  quoteCount: number;
  /** The quote the management chose (null: none yet). */
  chosenQuoteId: string | null;
  /** Why that one (required when not the cheapest or too few quotes). */
  choiceJustification: string | null;
  chosenAt: Date | null;
  /** Who chose it (null: not chosen, or the account was removed). */
  chosenById: string | null;
  chosenByName: string | null;
  cancelReason: string | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Limits of the free-text fields (characters) and of the items. */
export const PURCHASE_REQUEST_LIMITS = {
  title: 120,
  description: 1000,
  categoryOther: 60,
  location: 80,
  itemNote: 200,
  unit: 12,
  maxItems: 50,
  maxQuantity: 1_000_000,
  cancelReasonMin: 3,
  cancelReasonMax: 300,
} as const;

/** "SC-0007". */
export const requestCode = (number: number) =>
  `SC-${String(number).padStart(4, "0")}`;

/** Trimmed text with single spaces (null: empty; undefined: too long). */
export function requestText(
  value: string | null | undefined,
  max: number,
): string | null | undefined {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length <= max ? text : undefined;
}
