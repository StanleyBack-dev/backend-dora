import type { EventView } from "@/modules/events/application/ports/event-repository.port";
import {
  deliveryDraft,
  type DeliveryCalendar,
} from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { formatAddress } from "@/shared/domain/brazilian-address";
import { formatDateTime, formatTime } from "@/shared/domain/local-date";

// What residents are told about an event, as outbox drafts stored with the
// change. The calendar entry keeps one UID per event, so the cancellation
// removes the same entry from the person's phone.

const placeOf = (event: EventView) =>
  [
    event.spaceName,
    event.location,
    event.address ? formatAddress(event.address) : null,
  ]
    .filter(Boolean)
    .join(" · ");

/** "sáb., 20/12/2026, 19:00 às 23:00". */
export const eventPeriod = (event: EventView, timeZone: string) =>
  `${formatDateTime(event.startsAt, timeZone)} às ${formatTime(event.endsAt, timeZone)}`;

const calendar = (event: EventView, cancelled: boolean): DeliveryCalendar => ({
  uid: `event-${event.id}@dora`,
  sequence: cancelled ? 1 : 0,
  cancelled,
  start: event.startsAt.toISOString(),
  end: event.endsAt.toISOString(),
  summary: event.title,
  location: placeOf(event) || null,
  description: event.description,
});

/** To each member: a new event was published. */
export function publishedNotices(
  event: EventView,
  userIds: readonly string[],
  timeZone: string,
): OutboxDraft[] {
  const period = eventPeriod(event, timeZone);
  const place = placeOf(event);
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.EVENT_PUBLISHED,
        title: `Novo evento: ${event.title}`,
        body: place ? `${period} · ${place}` : period,
        link: `/eventos/${event.id}`,
        email: {
          subject: `Novo evento no condomínio: ${event.title}`,
          intro: event.ticketed
            ? "Um novo evento foi publicado. A entrada é com ingresso: veja os valores e como garantir o seu no app."
            : "Um novo evento foi publicado. Veja os detalhes e garanta a sua presença no app.",
          details: [
            { label: "Evento", value: event.title },
            { label: "Quando", value: period },
            ...(place ? [{ label: "Onde", value: place }] : []),
          ],
          ctaLabel: "Ver o evento",
        },
        calendar: calendar(event, false),
      },
      `event:${event.id}:published:${userId}`,
    ),
  );
}

/** To each member: a published event was cancelled. */
export function cancelledNotices(
  event: EventView,
  userIds: readonly string[],
  reason: string,
  timeZone: string,
): OutboxDraft[] {
  const period = eventPeriod(event, timeZone);
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.EVENT_CANCELLED,
        title: `Evento cancelado: ${event.title}`,
        body: `${period} · ${reason}`,
        link: `/eventos/${event.id}`,
        email: {
          subject: `Evento cancelado: ${event.title}`,
          intro: "O evento abaixo foi cancelado pela administração.",
          details: [
            { label: "Evento", value: event.title },
            { label: "Quando", value: period },
            { label: "Motivo", value: reason },
          ],
          ctaLabel: "Ver o evento",
        },
        calendar: calendar(event, true),
      },
      `event:${event.id}:cancelled:${userId}`,
    ),
  );
}
