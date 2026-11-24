import type { EventOrder } from "@/modules/events/application/ports/event-order-repository.port";
import { formatCents } from "@/shared/domain/money";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

// What people are told about ticket orders, as outbox drafts stored with
// the change: the reviewers when a receipt arrives, the buyer when it is
// confirmed or rejected.

const people = (order: Pick<EventOrder, "attendees">) =>
  order.attendees.length === 1
    ? "1 pessoa"
    : `${order.attendees.length} pessoas`;

/** To each reviewer: an order (receipt and/or documents) waits for review. */
export function receiptNotices(
  order: EventOrder,
  reviewerIds: readonly string[],
): OutboxDraft[] {
  const summary = `${order.code} · ${people(order)} · ${formatCents(order.totalCents)}`;
  return reviewerIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.EVENT_ORDER_RECEIPT,
        title: `Pedido para conferir: ${order.eventTitle}`,
        body: `${order.buyerName ?? "Morador"}${order.unitLabel ? ` (${order.unitLabel})` : ""} · ${summary}`,
        link: `/gestao/eventos/${order.eventId}/pedidos`,
        email: {
          subject: `Pedido de ingressos para conferir: ${order.eventTitle}`,
          intro:
            "Um morador enviou o que faltava no pedido de ingressos (o comprovante do PIX e/ou os documentos de quem tem desconto). Confira o pagamento no extrato pelo código do pedido, os documentos, e aprove ou recuse no app.",
          details: [
            { label: "Evento", value: order.eventTitle },
            { label: "Pedido", value: order.code },
            { label: "Quem", value: order.buyerName ?? "—" },
            ...(order.unitLabel
              ? [{ label: "Unidade", value: order.unitLabel }]
              : []),
            { label: "Valor", value: formatCents(order.totalCents) },
          ],
          ctaLabel: "Conferir no app",
        },
        calendar: null,
      },
      `event-order:${order.id}:review:${userId}`,
    ),
  );
}

/** What the buyer's notices need (a free order is told before it has an id). */
type OrderSummary = Pick<
  EventOrder,
  | "userId"
  | "eventId"
  | "eventTitle"
  | "code"
  | "attendees"
  | "totalCents"
  | "rejectReason"
>;

/** To the buyer: the order is confirmed (paid, or free). */
export function confirmedNotice(order: OrderSummary): OutboxDraft[] {
  if (!order.userId) return [];
  return [
    deliveryDraft(
      {
        userId: order.userId,
        type: NotificationType.EVENT_ORDER_CONFIRMED,
        title: `Ingressos confirmados: ${order.eventTitle}`,
        body: `${order.code} · ${people(order)}`,
        link: `/eventos/${order.eventId}`,
        email: {
          subject: `Ingressos confirmados: ${order.eventTitle}`,
          intro:
            order.totalCents > 0
              ? "O pagamento dos seus ingressos foi conferido e o pedido está confirmado. Os ingressos com QR code de cada pessoa estão no app, na página do evento: mostre na portaria ou envie o link a quem vai com você."
              : "Sua inscrição no evento está confirmada. Os ingressos com QR code de cada pessoa estão no app, na página do evento: mostre na portaria ou envie o link a quem vai com você.",
          details: [
            { label: "Evento", value: order.eventTitle },
            { label: "Pedido", value: order.code },
            {
              label: "Pessoas",
              value: order.attendees.map((person) => person.name).join(", "),
            },
          ],
          ctaLabel: "Ver os ingressos",
        },
        calendar: null,
      },
      `event-order:${order.code}:confirmed`,
    ),
  ];
}

/** To the buyer: the receipt was not accepted (with the reason). */
export function rejectedNotice(order: OrderSummary): OutboxDraft[] {
  if (!order.userId) return [];
  return [
    deliveryDraft(
      {
        userId: order.userId,
        type: NotificationType.EVENT_ORDER_REJECTED,
        title: `Comprovante recusado: ${order.eventTitle}`,
        body: `${order.code} · ${order.rejectReason ?? ""}`,
        link: `/eventos/${order.eventId}`,
        email: {
          subject: `Comprovante recusado: ${order.eventTitle}`,
          intro:
            "A administração não aceitou o comprovante do seu pedido. Se já pagou, fale com a administração; se não, faça um novo pedido no app.",
          details: [
            { label: "Evento", value: order.eventTitle },
            { label: "Pedido", value: order.code },
            { label: "Motivo", value: order.rejectReason ?? "—" },
          ],
          ctaLabel: "Ver o evento",
        },
        calendar: null,
      },
      `event-order:${order.code}:rejected`,
    ),
  ];
}
