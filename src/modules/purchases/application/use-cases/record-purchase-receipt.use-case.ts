import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  PURCHASE_ORDER_REPOSITORY,
  type PurchaseOrderRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-order-repository.port";
import {
  boundedText,
  missingPermission,
  orderInvalid,
} from "@/modules/purchases/application/purchase-errors";
import { PurchaseOrderFiles } from "@/modules/purchases/application/purchase-order-files";
import {
  completedNotices,
  receiptNotices,
} from "@/modules/purchases/application/purchase-order-notices";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ListPurchaseOrdersUseCase,
  type OrderView,
} from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import {
  fullyPaid,
  fullyReceived,
  ORDER_LIMITS,
  pendingByItem,
  type PurchaseOrder,
  roundQuantity,
} from "@/modules/purchases/domain/purchase-order";
import {
  type PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { isLocalDate, toLocalDate } from "@/shared/domain/local-date";

export type ReceiptInput = {
  receivedOn: string;
  /** What arrived of each item (items left out: nothing). */
  items: { requestItemId: string; quantity: number }[];
  invoiceNumber: string | null;
  invoiceCents: number | null;
  invoiceDate: string | null;
  note: string | null;
};

type ReceivedItem = { requestItemId: string; quantity: number };

/**
 * The items that arrived (zeros dropped): each one of the request, once,
 * and no more than is still to arrive.
 */
function receivedItems(
  input: ReceiptInput["items"],
  pending: Map<string, number>,
): ReceivedItem[] {
  const items = input
    .map((item) => ({ ...item, quantity: roundQuantity(item.quantity) }))
    .filter((item) => item.quantity > 0);
  if (items.length === 0) {
    throw orderInvalid("Informe a quantidade que chegou de ao menos um item.");
  }
  const seen = new Set<string>();
  for (const item of items) {
    const left = pending.get(item.requestItemId);
    if (left === undefined || seen.has(item.requestItemId)) {
      throw orderInvalid("Um dos itens não é desta compra.");
    }
    if (item.quantity > left) {
      throw orderInvalid(
        "A quantidade recebida passa do que falta chegar de um dos itens.",
      );
    }
    seen.add(item.requestItemId);
  }
  return items;
}

/** The invoice's value and day, checked (the number goes as typed). */
function checkInvoice(input: ReceiptInput, today: string) {
  const cents = input.invoiceCents;
  if (
    cents !== null &&
    (!Number.isInteger(cents) ||
      cents < 0 ||
      cents > ORDER_LIMITS.maxInvoiceCents)
  ) {
    throw orderInvalid("O valor da nota não é válido.");
  }
  if (
    input.invoiceDate !== null &&
    (!isLocalDate(input.invoiceDate) || input.invoiceDate > today)
  ) {
    throw orderInvalid("A data da nota não pode ser no futuro.");
  }
}

/**
 * A delivery of an order arrives, in full or in part: the management or the
 * gate records the day, what came of each item, the invoice and a note.
 * Once every item arrived the purchase is received (completed, if also
 * paid); the requester and the managers are told. A delivery recorded by
 * mistake is removed by the management or by whoever recorded it.
 */
@Injectable()
export class RecordPurchaseReceiptUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    private readonly listing: ListPurchaseOrdersUseCase,
    private readonly files: PurchaseOrderFiles,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async add(
    actor: AuthenticatedUser,
    requestId: string,
    input: ReceiptInput,
    file: string | null,
  ): Promise<OrderView> {
    const access = await this.access.orderAccess(actor);
    const request = await this.listing.loadRequest(access, requestId);
    const order =
      request.status === PurchaseRequestStatus.ORDERED
        ? await this.orders.findByRequest(access.condominiumId, request.id)
        : null;
    if (!order) {
      throw orderInvalid(
        request.status === PurchaseRequestStatus.APPROVED
          ? "Faça o pedido antes de registrar a entrega."
          : "Esta compra já foi toda recebida.",
      );
    }
    const now = this.clock.now();
    const today = toLocalDate(now, this.clock.timeZone);
    const orderedOn = toLocalDate(order.orderedAt, this.clock.timeZone);
    if (
      !isLocalDate(input.receivedOn) ||
      input.receivedOn < orderedOn ||
      input.receivedOn > today
    ) {
      throw orderInvalid("A data da entrega vai do dia do pedido até hoje.");
    }
    const items = receivedItems(
      input.items,
      pendingByItem(request.items, order.receipts),
    );
    checkInvoice(input, today);
    const invoiceNumber = boundedText(
      input.invoiceNumber,
      ORDER_LIMITS.invoiceNumber,
      () =>
        orderInvalid(
          `O número da nota vai até ${ORDER_LIMITS.invoiceNumber} caracteres.`,
        ),
    );
    const note = boundedText(input.note, ORDER_LIMITS.receiptNote, () =>
      orderInvalid(
        `A observação vai até ${ORDER_LIMITS.receiptNote} caracteres.`,
      ),
    );

    const notices = await this.notices(actor, request, order, items, now);
    const stored = await this.files.store(access.condominiumId, file);
    try {
      await this.orders.addReceipt(
        order.id,
        {
          receivedOn: input.receivedOn,
          items,
          invoiceNumber,
          invoiceCents: input.invoiceCents,
          invoiceDate: input.invoiceDate,
          fileKey: stored.key,
          fileIsPdf: stored.isPdf,
          note,
          receivedById: actor.id,
        },
        notices,
      );
    } catch (cause) {
      await this.files.drop(stored.key);
      throw cause;
    }
    await this.stamp(actor, request.id);
    return this.listing.view(actor, request.id);
  }

  async remove(
    actor: AuthenticatedUser,
    requestId: string,
    receiptId: string,
  ): Promise<OrderView> {
    const access = await this.access.orderAccess(actor);
    const request = await this.listing.loadRequest(access, requestId);
    const order = await this.orders.findByRequest(
      access.condominiumId,
      request.id,
    );
    const receipt = order?.receipts.find((item) => item.id === receiptId);
    if (!order || !receipt) {
      throw AppException.from(APP_ERRORS.purchases.orderChanged, undefined);
    }
    if (!access.manage && receipt.receivedById !== actor.id) {
      throw missingPermission();
    }
    const fileKey = await this.orders.removeReceipt(order.id, receipt.id);
    if (fileKey === undefined) {
      throw AppException.from(APP_ERRORS.purchases.orderChanged, undefined);
    }
    await this.files.drop(fileKey);
    await this.stamp(actor, request.id);
    return this.listing.view(actor, request.id);
  }

  /** Received in part or in full; completed too when already paid. */
  private async notices(
    actor: AuthenticatedUser,
    request: PurchaseRequest,
    order: PurchaseOrder,
    items: ReceivedItem[],
    now: Date,
  ) {
    const complete = fullyReceived(request.items, [
      ...order.receipts,
      { items },
    ]);
    const managers = await this.access.managers(order.condominiumId);
    const who = { id: actor.id, name: actor.name };
    return [
      ...receiptNotices(request, order, who, complete, managers, now),
      ...(complete && fullyPaid(order.installments)
        ? completedNotices(request, order, who, managers, now)
        : []),
    ];
  }

  private stamp(actor: AuthenticatedUser, requestId: string) {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: requestId,
    });
  }
}
