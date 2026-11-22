import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import {
  type PurchaseRequest,
  requestCode,
} from "@/modules/purchases/domain/purchase-request";

/** A request's page in the app. */
const requestLink = (request: PurchaseRequest) =>
  `/compras/solicitacoes/${request.id}`;

const itemsLine = (request: PurchaseRequest) =>
  request.items.length === 1 ? "1 item" : `${request.items.length} itens`;

/** A request was made: the managers (but whoever made it) are told. */
export function requestCreatedNotices(
  request: PurchaseRequest,
  managers: readonly string[],
): OutboxDraft[] {
  const code = requestCode(request.number);
  return managers
    .filter((userId) => userId !== request.requestedById)
    .map((userId) =>
      deliveryDraft(
        {
          userId,
          type: NotificationType.PURCHASE_REQUEST_CREATED,
          title: `Nova solicitação de compra ${code}`,
          body: `${request.requestedByName} pediu “${request.title}” (${itemsLine(request)}).`,
          link: requestLink(request),
          email: {
            subject: `Nova solicitação de compra ${code}: ${request.title}`,
            intro: `${request.requestedByName} fez uma solicitação de compra. Confira os itens e comece as cotações no app.`,
            details: [
              { label: "Solicitação", value: `${code} · ${request.title}` },
              { label: "Itens", value: itemsLine(request) },
              ...(request.neededBy
                ? [{ label: "Precisa até", value: request.neededBy }]
                : []),
            ],
            ctaLabel: "Ver no app",
          },
          calendar: null,
        },
        `purchase-request:${request.id}:created:${userId}`,
      ),
    );
}

/** Someone else cancelled a request: whoever made it is told why. */
export function requestCancelledNotices(
  request: PurchaseRequest,
  cancelledBy: { id: string; name: string },
  reason: string,
): OutboxDraft[] {
  if (cancelledBy.id === request.requestedById) return [];
  const code = requestCode(request.number);
  return [
    deliveryDraft(
      {
        userId: request.requestedById,
        type: NotificationType.PURCHASE_REQUEST_CANCELLED,
        title: `Solicitação de compra ${code} cancelada`,
        body: `${cancelledBy.name} cancelou “${request.title}”. Motivo: ${reason}`,
        link: requestLink(request),
        email: {
          subject: `Solicitação de compra cancelada: ${request.title}`,
          intro: `${cancelledBy.name} cancelou a sua solicitação de compra.`,
          details: [
            { label: "Solicitação", value: `${code} · ${request.title}` },
            { label: "Motivo", value: reason },
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `purchase-request:${request.id}:cancelled`,
    ),
  ];
}
