import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { orderCode } from "@/modules/purchases/domain/purchase-order";
import {
  type PurchaseRequest,
  requestCode,
} from "@/modules/purchases/domain/purchase-request";
import { formatLocalDate } from "@/shared/domain/local-date";
import { formatCents } from "@/shared/domain/money";

/** The purchase's order page (the management, the approvers, the gate). */
const orderLink = (request: PurchaseRequest) =>
  `/compras/pedidos/${request.id}`;

type Actor = { id: string; name: string };

/** Whoever asked for it and the managers, but whoever acted. */
const recipients = (
  request: PurchaseRequest,
  managers: readonly string[],
  actor: Actor,
) =>
  [...new Set([request.requestedById, ...managers])].filter(
    (userId) => userId !== actor.id,
  );

function notices(
  request: PurchaseRequest,
  users: string[],
  type: NotificationType,
  title: string,
  body: string,
  details: { label: string; value: string }[],
  key: string,
  link = orderLink(request),
): OutboxDraft[] {
  return users.map((userId) =>
    deliveryDraft(
      {
        userId,
        type,
        title,
        body,
        link,
        email: {
          subject: `${title}: ${request.title}`,
          intro: body,
          details: [
            {
              label: "Solicitação",
              value: `${requestCode(request.number)} · ${request.title}`,
            },
            ...details,
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `purchase-request:${request.id}:${key}:${userId}`,
    ),
  );
}

/** The order was placed: who asked for it and the managers are told. */
export function orderPlacedNotices(
  request: PurchaseRequest,
  order: {
    number: number;
    supplierName: string;
    totalCents: number;
    expectedOn: string | null;
  },
  orderedBy: Actor,
  managers: readonly string[],
): OutboxDraft[] {
  const code = orderCode(order.number);
  const when = order.expectedOn
    ? ` Entrega prevista para ${formatLocalDate(order.expectedOn)}.`
    : "";
  return notices(
    request,
    recipients(request, managers, orderedBy),
    NotificationType.PURCHASE_ORDERED,
    `Pedido ${code} feito`,
    `${orderedBy.name} fez o pedido de “${request.title}” com ${order.supplierName} (${formatCents(order.totalCents)}).${when}`,
    [
      { label: "Pedido", value: code },
      { label: "Fornecedor", value: order.supplierName },
      ...(order.expectedOn
        ? [
            {
              label: "Entrega prevista",
              value: formatLocalDate(order.expectedOn),
            },
          ]
        : []),
    ],
    `ordered:${order.number}`,
  );
}

/** A delivery arrived (in part or in full). */
export function receiptNotices(
  request: PurchaseRequest,
  order: { number: number; supplierName: string },
  receivedBy: Actor,
  complete: boolean,
  managers: readonly string[],
  at: Date,
): OutboxDraft[] {
  const code = orderCode(order.number);
  const what = complete ? "chegou completa" : "chegou em parte";
  return notices(
    request,
    recipients(request, managers, receivedBy),
    NotificationType.PURCHASE_RECEIVED,
    complete ? `Compra ${code} recebida` : `Entrega parcial do ${code}`,
    `A entrega de “${request.title}” (${order.supplierName}) ${what}, recebida por ${receivedBy.name}.`,
    [
      { label: "Pedido", value: code },
      { label: "Fornecedor", value: order.supplierName },
    ],
    `received:${at.getTime()}`,
  );
}

/** Received and paid in full: the purchase is completed. */
export function completedNotices(
  request: PurchaseRequest,
  order: { number: number; supplierName: string; totalCents: number },
  actor: Actor,
  managers: readonly string[],
  at: Date,
): OutboxDraft[] {
  const code = orderCode(order.number);
  return notices(
    request,
    recipients(request, managers, actor),
    NotificationType.PURCHASE_COMPLETED,
    `Compra ${code} concluída`,
    `“${request.title}” foi recebida e paga (${order.supplierName}, ${formatCents(order.totalCents)}).`,
    [
      { label: "Pedido", value: code },
      { label: "Fornecedor", value: order.supplierName },
      { label: "Total", value: formatCents(order.totalCents) },
    ],
    `completed:${at.getTime()}`,
  );
}

/**
 * The order was cancelled: the purchase is approved again, to reorder, or
 * back to the quotes, to choose another supplier.
 */
export function orderCancelledNotices(
  request: PurchaseRequest,
  order: { number: number; supplierName: string },
  actor: Actor,
  cancel: { reason: string; backToQuotes: boolean },
  managers: readonly string[],
  at: Date,
): OutboxDraft[] {
  const code = orderCode(order.number);
  const next = cancel.backToQuotes ? " e a compra voltou às cotações" : "";
  return notices(
    request,
    recipients(request, managers, actor),
    NotificationType.PURCHASE_ORDER_CANCELLED,
    `Pedido ${code} cancelado`,
    `${actor.name} cancelou o pedido de “${request.title}” com ${order.supplierName}${next}. Motivo: ${cancel.reason}`,
    [
      { label: "Pedido", value: code },
      { label: "Fornecedor", value: order.supplierName },
      { label: "Motivo", value: cancel.reason },
    ],
    `order-cancelled:${at.getTime()}`,
    cancel.backToQuotes ? `/compras/cotacoes/${request.id}` : undefined,
  );
}
