import type { EventOrder } from "@/modules/events/application/ports/event-order-repository.port";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import type { EventOrderType } from "@/modules/events/presentation/graphql/dto/outputs/event-order.output";
import { pixPayload } from "@/shared/domain/pix";

/** An order as the API shows it; the PIX code only while it is unpaid. */
export function toOrderType(order: EventOrder): EventOrderType {
  return {
    id: order.id,
    eventId: order.eventId,
    eventTitle: order.eventTitle,
    code: order.code,
    status: order.status,
    totalCents: order.totalCents,
    buyerName: order.buyerName,
    unitLabel: order.unitLabel,
    // The ticket codes only once the order is confirmed (the QR is valid).
    attendees: order.attendees.map((person) => ({
      ...person,
      ticketCode:
        order.status === EventOrderStatus.CONFIRMED ? person.ticketCode : null,
    })),
    pix: order.pix,
    pixCode:
      order.status === EventOrderStatus.PENDING_PAYMENT && order.pix
        ? pixPayload(order.pix, order.totalCents, order.code)
        : null,
    expiresAt: order.expiresAt,
    receiptSentAt: order.receiptSentAt,
    receiptContentType: order.receiptContentType,
    receiptKey: order.receiptKey,
    reviewedAt: order.reviewedAt,
    rejectReason: order.rejectReason,
    cancelledAt: order.cancelledAt,
    createdAt: order.createdAt,
  };
}
