import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  type DeliveryBoardOverview,
  type OrderBoardOverview,
  PURCHASE_ORDER_REPOSITORY,
  type PurchaseOrderRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-order-repository.port";
import {
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestFilter,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  type OrderAccess,
  PurchasesAccessService,
} from "@/modules/purchases/application/purchases-access.service";
import {
  type CancelledPurchaseOrder,
  ORDER_RATING_SOURCE,
  type PurchaseInstallment,
  type PurchaseOrder,
  type PurchaseReceipt,
  pendingByItem,
  receivedByItem,
} from "@/modules/purchases/domain/purchase-order";
import {
  installmentPlan,
  lineCents,
  type PaymentMethod,
  quoteTotals,
} from "@/modules/purchases/domain/purchase-quote";
import {
  type PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import {
  SUPPLIER_REPOSITORY,
  type SupplierRepositoryPort,
} from "@/modules/suppliers/application/ports/supplier-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { startOfLocalDate, toLocalDate } from "@/shared/domain/local-date";

/** The stages the orders page shows to the management and the approvers. */
export const ORDER_BOARD_STATUSES: readonly PurchaseRequestStatus[] = [
  PurchaseRequestStatus.APPROVED,
  PurchaseRequestStatus.ORDERED,
  PurchaseRequestStatus.RECEIVED,
  PurchaseRequestStatus.COMPLETED,
];

/** What the gate sees: the orders placed (to receive their deliveries). */
export const DELIVERY_BOARD_STATUSES: readonly PurchaseRequestStatus[] = [
  PurchaseRequestStatus.ORDERED,
  PurchaseRequestStatus.RECEIVED,
  PurchaseRequestStatus.COMPLETED,
];

/** A request's item with how its delivery stands (and, if seen, prices). */
export type OrderLine = {
  requestItemId: string;
  productName: string;
  brandName: string | null;
  note: string | null;
  unit: string;
  quantity: number;
  received: number;
  pending: number;
  unitPriceCents: number | null;
  lineCents: number | null;
};

/** What the order of an approved request will be (from the chosen quote). */
export type OrderPlan = {
  supplierName: string;
  itemsCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod | null;
  paymentTerms: string | null;
  deliveryDays: number | null;
  /** Each installment (one: paid at once). */
  installmentValues: number[];
};

export type ReceiptView = PurchaseReceipt & { fileUrl: string | null };
export type InstallmentView = PurchaseInstallment & {
  proofUrl: string | null;
};

/** The order with links to its files (values hidden from the gate). */
export type OrderDetail = Omit<
  PurchaseOrder,
  "itemsCents" | "totalCents" | "receipts" | "installments"
> & {
  itemsCents: number | null;
  totalCents: number | null;
  /** To send the order to (null: none registered, or hidden). */
  supplierEmail: string | null;
  /** For WhatsApp (null: none registered, or hidden). */
  supplierPhone: string | null;
  receipts: ReceiptView[];
  /** Empty for whoever doesn't see the values. */
  installments: InstallmentView[];
};

export type CancelledOrderView = Omit<CancelledPurchaseOrder, "totalCents"> & {
  totalCents: number | null;
};

/** The order page of a purchase. */
export type OrderView = {
  request: PurchaseRequest;
  /** null: approved, the order still to place. */
  order: OrderDetail | null;
  lines: OrderLine[];
  /** With no order yet: what it will be (null: hidden or not approved). */
  plan: OrderPlan | null;
  /** Orders cancelled before, the latest first (values hidden from the gate). */
  cancelledOrders: CancelledOrderView[];
  canManage: boolean;
  canSeeMoney: boolean;
};

/** A purchase on the orders page. */
export type OrderBoardRow = {
  request: PurchaseRequest;
  /** The order's code number (null: not placed yet). */
  orderNumber: number | null;
  supplierName: string | null;
  /** null: hidden from the gate. */
  totalCents: number | null;
  expectedOn: string | null;
  /** Items fully arrived, of how many. */
  itemsReceived: number;
  itemCount: number;
  /** Deliveries recorded (some may have arrived though no item is complete). */
  receiptCount: number;
  /** Installments paid, of how many (0 of 0: hidden or not placed). */
  installmentsPaid: number;
  installmentCount: number;
  /** The next unpaid installment's due day (null: none or hidden). */
  nextDueOn: string | null;
};

/**
 * The orders page (Compras > Pedidos): the approved purchases, their orders,
 * deliveries and payments; the page's cards; and one purchase's order page.
 * The gate (PURCHASES_REQUEST) sees the placed orders to receive them,
 * without any value.
 */
@Injectable()
export class ListPurchaseOrdersUseCase {
  constructor(
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    @Inject(PURCHASE_QUOTE_REPOSITORY)
    private readonly quotes: PurchaseQuoteRepositoryPort,
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    @Inject(SUPPLIER_REPOSITORY)
    private readonly suppliers: SupplierRepositoryPort,
    private readonly access: PurchasesAccessService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  /** A request the caller may see on the orders page. */
  async loadRequest(
    access: OrderAccess,
    requestId: string,
  ): Promise<PurchaseRequest> {
    const request = await this.requests.find(access.condominiumId, requestId);
    const stages = access.money
      ? ORDER_BOARD_STATUSES
      : DELIVERY_BOARD_STATUSES;
    if (!request || !stages.includes(request.status)) {
      throw AppException.from(APP_ERRORS.purchases.requestNotFound, undefined);
    }
    return request;
  }

  /** What the order of an approved request will be. */
  async plan(request: PurchaseRequest): Promise<OrderPlan | null> {
    const quote = request.chosenQuoteId
      ? await this.quotes.find(request.condominiumId, request.chosenQuoteId)
      : null;
    if (!quote) return null;
    const totals = quoteTotals(
      quote,
      new Map(request.items.map((item) => [item.id, item.quantity])),
    );
    return {
      supplierName: quote.supplierName,
      itemsCents: totals.itemsCents,
      totalCents: totals.totalCents,
      paymentMethod: quote.paymentMethod,
      paymentTerms: quote.paymentTerms,
      deliveryDays: quote.deliveryDays,
      installmentValues: installmentPlan(
        totals.cashCents,
        quote.installments ?? 1,
        quote.installments ? quote.interestRateBp : null,
      ),
    };
  }

  async view(actor: AuthenticatedUser, requestId: string): Promise<OrderView> {
    const access = await this.access.orderAccess(actor);
    const request = await this.loadRequest(access, requestId);
    const [order, cancelled] = await Promise.all([
      this.orders.findByRequest(access.condominiumId, request.id),
      this.orders.cancelledByRequest(access.condominiumId, request.id),
    ]);
    const quote =
      access.money && request.chosenQuoteId
        ? await this.quotes.find(access.condominiumId, request.chosenQuoteId)
        : null;
    const received = receivedByItem(order?.receipts ?? []);
    const pending = pendingByItem(request.items, order?.receipts ?? []);
    return {
      request,
      order: order ? await this.detail(order, access.money) : null,
      lines: request.items.map((item) => {
        const unitPriceCents = quote
          ? (quote.items.find((line) => line.requestItemId === item.id)
              ?.unitPriceCents ?? null)
          : null;
        return {
          requestItemId: item.id,
          productName: item.productName,
          brandName: item.brandName,
          note: item.note,
          unit: item.unit,
          quantity: item.quantity,
          received: received.get(item.id) ?? 0,
          pending: pending.get(item.id) ?? 0,
          unitPriceCents,
          lineCents:
            unitPriceCents === null
              ? null
              : lineCents(item.quantity, unitPriceCents),
        };
      }),
      plan:
        !order &&
        access.money &&
        request.status === PurchaseRequestStatus.APPROVED
          ? await this.plan(request)
          : null,
      cancelledOrders: cancelled.map((item) => ({
        ...item,
        totalCents: access.money ? item.totalCents : null,
      })),
      canManage: access.manage,
      canSeeMoney: access.money,
    };
  }

  /** The deliveries with a link to each invoice (its value hidden or not). */
  private receiptViews(
    order: PurchaseOrder,
    money: boolean,
  ): Promise<ReceiptView[]> {
    return Promise.all(
      order.receipts.map(async (receipt) => ({
        ...receipt,
        invoiceCents: money ? receipt.invoiceCents : null,
        fileUrl: receipt.fileKey
          ? await this.storage.signedReadUrl(receipt.fileKey)
          : null,
      })),
    );
  }

  private async detail(
    order: PurchaseOrder,
    money: boolean,
  ): Promise<OrderDetail> {
    const [rating, supplier] = await Promise.all([
      this.suppliers.ratingFor({
        source: ORDER_RATING_SOURCE,
        sourceId: order.id,
      }),
      money && order.supplierId
        ? this.suppliers.find(order.condominiumId, order.supplierId)
        : null,
    ]);
    return {
      ...order,
      itemsCents: money ? order.itemsCents : null,
      totalCents: money ? order.totalCents : null,
      supplierEmail: supplier?.email ?? null,
      supplierPhone: supplier?.phone ?? null,
      rating: money ? rating : null,
      receipts: await this.receiptViews(order, money),
      installments: money
        ? await Promise.all(
            order.installments.map(async (installment) => ({
              ...installment,
              proofUrl: installment.proofKey
                ? await this.storage.signedReadUrl(installment.proofKey)
                : null,
            })),
          )
        : [],
    };
  }

  async list(
    actor: AuthenticatedUser,
    filter: PurchaseRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<OrderBoardRow>> {
    const access = await this.access.orderAccess(actor);
    const stages = access.money
      ? ORDER_BOARD_STATUSES
      : DELIVERY_BOARD_STATUSES;
    const statuses = filter.statuses?.length
      ? filter.statuses.filter((status) => stages.includes(status))
      : [...stages];
    if (!statuses.length) {
      return {
        items: [],
        total: 0,
        page: page.page,
        limit: page.limit,
        totalPages: 1,
      };
    }
    const requests = await this.requests.list(
      { condominiumId: access.condominiumId, requesterId: null },
      { ...filter, statuses },
      page,
    );
    return {
      ...requests,
      items: await Promise.all(
        requests.items.map((request) => this.row(request, access.money)),
      ),
    };
  }

  private async row(
    request: PurchaseRequest,
    money: boolean,
  ): Promise<OrderBoardRow> {
    const order = await this.orders.findByRequest(
      request.condominiumId,
      request.id,
    );
    const pending = pendingByItem(request.items, order?.receipts ?? []);
    const base = {
      request,
      itemsReceived: [...pending.values()].filter((left) => left === 0).length,
      itemCount: request.items.length,
      receiptCount: order?.receipts.length ?? 0,
    };
    if (!order) {
      const plan = money ? await this.plan(request) : null;
      return {
        ...base,
        orderNumber: null,
        supplierName: plan?.supplierName ?? null,
        totalCents: plan?.totalCents ?? null,
        expectedOn: null,
        installmentsPaid: 0,
        installmentCount: 0,
        nextDueOn: null,
      };
    }
    const unpaid = order.installments.filter(
      (installment) => installment.paidOn === null,
    );
    return {
      ...base,
      orderNumber: order.number,
      supplierName: order.supplierName,
      totalCents: money ? order.totalCents : null,
      expectedOn: order.expectedOn,
      installmentsPaid: money ? order.installments.length - unpaid.length : 0,
      installmentCount: money ? order.installments.length : 0,
      nextDueOn: money ? (unpaid[0]?.dueOn ?? null) : null,
    };
  }

  /** The orders page's cards (the management and the approvers). */
  async overview(actor: AuthenticatedUser): Promise<OrderBoardOverview> {
    const { condominiumId } = await this.access.orderAccess(actor, "money");
    const today = toLocalDate(this.clock.now(), this.clock.timeZone);
    return this.orders.overview(
      condominiumId,
      today,
      startOfLocalDate(`${today.slice(0, 8)}01`, this.clock.timeZone),
    );
  }

  /** The deliveries page's cards (the gate too). */
  async deliveryOverview(
    actor: AuthenticatedUser,
  ): Promise<DeliveryBoardOverview> {
    const { condominiumId } = await this.access.orderAccess(actor);
    const today = toLocalDate(this.clock.now(), this.clock.timeZone);
    return this.orders.deliveryOverview(
      condominiumId,
      today,
      `${today.slice(0, 8)}01`,
    );
  }
}
