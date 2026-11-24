import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type {
  CancelledPurchaseOrder,
  InstallmentState,
  PurchaseInstallment,
  PurchaseOrder,
  PurchaseReceipt,
} from "@/modules/purchases/domain/purchase-order";
import type { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** An order to place (its number is given when stored). */
export type NewPurchaseOrder = Omit<
  PurchaseOrder,
  | "id"
  | "number"
  | "orderedByName"
  | "completedAt"
  | "receipts"
  | "installments"
  | "rating"
>;

/** An installment to pay, as the order is placed. */
export type NewInstallment = Pick<
  PurchaseInstallment,
  "number" | "amountCents" | "dueOn"
>;

/** A delivery to record. */
export type NewReceipt = Omit<
  PurchaseReceipt,
  "id" | "orderId" | "receivedByName" | "createdAt"
>;

/** A payment to record on an installment. */
export type InstallmentPayment = {
  paidOn: string;
  paidById: string;
  proofKey: string | null;
  proofIsPdf: boolean | null;
  note: string | null;
};

/** The deliveries page's cards. */
export type DeliveryBoardOverview = {
  /** Ordered, nothing or part arrived. */
  awaitingDelivery: number;
  /** Of those, past the expected day. */
  lateDeliveries: number;
  /** Of those, with part already arrived. */
  partialDeliveries: number;
  /** Deliveries recorded this month. */
  receiptsThisMonth: number;
};

export type InstallmentFilter = {
  states?: InstallmentState[];
  requestId?: string;
  supplierId?: string;
};

/** An installment on the payments page, with its purchase. */
export type InstallmentBoardRow = PurchaseInstallment & {
  requestId: string;
  requestNumber: number;
  requestTitle: string;
  orderNumber: number;
  orderedAt: Date;
  supplierName: string;
  /** How many installments the order has (1: paid at once). */
  installmentCount: number;
};

/** The payments page's cards. */
export type InstallmentBoardOverview = {
  openCents: number;
  openCount: number;
  overdueCents: number;
  overdueCount: number;
  /** Not paid, due in the next 7 days. */
  dueSoonCents: number;
  dueSoonCount: number;
  paidThisMonthCents: number;
  paidThisMonthCount: number;
};

/** The orders page's cards. */
export type OrderBoardOverview = {
  /** Approved, the order still to place. */
  toOrder: number;
  /** Ordered, waiting for (the rest of) the delivery. */
  awaitingDelivery: number;
  /** Installments not paid yet and their sum. */
  unpaidInstallments: number;
  unpaidCents: number;
  /** Of those, past the due day. */
  overdueInstallments: number;
  /** Completed this month. */
  completedThisMonth: number;
};

/**
 * Every write that changes how an order stands also sets the request's
 * status from it (ordered → received → completed, and back when a delivery
 * or a payment is undone), in the same transaction.
 */
export interface PurchaseOrderRepositoryPort {
  /** A request's order, with its deliveries, installments and rating. */
  findByRequest(
    condominiumId: string,
    requestId: string,
  ): Promise<PurchaseOrder | null>;

  /** A request's cancelled orders, the latest first. */
  cancelledByRequest(
    condominiumId: string,
    requestId: string,
  ): Promise<CancelledPurchaseOrder[]>;

  /**
   * Places the order of an approved request (it moves to ORDERED) with its
   * installments; false when the request is no longer approved. The
   * notices are built from the number it gets.
   */
  create(
    order: NewPurchaseOrder,
    installments: NewInstallment[],
    notices: (number: number) => OutboxDraft[],
  ): Promise<boolean>;

  /** Records a delivery; the request's status after it. */
  addReceipt(
    orderId: string,
    receipt: NewReceipt,
    notices: OutboxDraft[],
  ): Promise<PurchaseRequestStatus>;

  /** Removes a delivery; its file's key (undefined: not found). */
  removeReceipt(
    orderId: string,
    receiptId: string,
  ): Promise<string | null | undefined>;

  /** Marks an installment paid; false when not found or already paid. */
  payInstallment(
    orderId: string,
    installmentId: string,
    payment: InstallmentPayment,
    notices: OutboxDraft[],
  ): Promise<boolean>;

  /**
   * Undoes an installment's payment; its proof's key (undefined: not found
   * or not paid).
   */
  unpayInstallment(
    orderId: string,
    installmentId: string,
  ): Promise<string | null | undefined>;

  /**
   * Cancels a placed order with nothing received nor paid: the purchase goes
   * back to APPROVED or, with `backToQuotes`, to the quotes (the choice
   * undone); false when something arrived or was paid meanwhile.
   */
  cancel(
    orderId: string,
    cancel: { by: string; reason: string; backToQuotes: boolean },
    notices: OutboxDraft[],
  ): Promise<boolean>;

  /** Moves an unpaid installment's due day; false when not found or paid. */
  reschedule(
    orderId: string,
    installmentId: string,
    dueOn: string,
  ): Promise<boolean>;

  /** The installments of the active orders, by due day (paged). */
  installments(
    condominiumId: string,
    filter: InstallmentFilter,
    page: PageRequest,
    today: string,
  ): Promise<Paginated<InstallmentBoardRow>>;

  /** The payments page's cards. */
  installmentOverview(
    condominiumId: string,
    today: string,
    monthStart: string,
  ): Promise<InstallmentBoardOverview>;

  /** The deliveries page's cards. */
  deliveryOverview(
    condominiumId: string,
    today: string,
    monthStart: string,
  ): Promise<DeliveryBoardOverview>;

  /** The orders page's cards. */
  overview(
    condominiumId: string,
    today: string,
    monthStart: Date,
  ): Promise<OrderBoardOverview>;
}

export const PURCHASE_ORDER_REPOSITORY = Symbol("PURCHASE_ORDER_REPOSITORY");
