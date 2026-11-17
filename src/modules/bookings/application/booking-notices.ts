import type { Booking } from "@/modules/bookings/domain/booking";
import {
  deliveryDraft,
  type DeliveryCalendar,
  type NotificationDelivery,
} from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { formatDateTime, formatTime } from "@/shared/domain/local-date";

// The notices of each booking event, built as outbox drafts so they are
// stored in the same transaction as the change. Confirmed bookings carry a
// calendar entry; its UID is stable per booking, so approval and
// cancellation update or remove the same entry on the person's phone.

type BookingInfo = Pick<Booking, "id" | "startsAt" | "endsAt"> & {
  spaceName: string;
};

/** "sáb., 15/11/2026, 19:00 às 20:00". */
export const formatPeriod = (booking: BookingInfo, timeZone: string) =>
  `${formatDateTime(booking.startsAt, timeZone)} às ${formatTime(booking.endsAt, timeZone)}`;

const calendar = (
  booking: BookingInfo,
  sequence: number,
  cancelled: boolean,
): DeliveryCalendar => ({
  uid: `booking-${booking.id}@dora`,
  sequence,
  cancelled,
  start: booking.startsAt.toISOString(),
  end: booking.endsAt.toISOString(),
  summary: `Reserva: ${booking.spaceName}`,
  location: booking.spaceName,
  description: null,
});

const draft = (
  key: string,
  booking: BookingInfo,
  delivery: NotificationDelivery,
): OutboxDraft =>
  deliveryDraft(delivery, `booking:${booking.id}:${key}:${delivery.userId}`);

/** To the booker: the booking is confirmed (now or after approval). */
export function confirmedNotice(
  userId: string,
  booking: BookingInfo,
  timeZone: string,
  afterApproval: boolean,
): OutboxDraft {
  const period = formatPeriod(booking, timeZone);
  return draft(afterApproval ? "approved" : "confirmed", booking, {
    userId,
    type: NotificationType.BOOKING_CONFIRMED,
    title: afterApproval
      ? `Reserva aprovada: ${booking.spaceName}`
      : `Reserva confirmada: ${booking.spaceName}`,
    body: period,
    link: "/reservas",
    email: {
      subject: `Reserva confirmada: ${booking.spaceName}`,
      intro: afterApproval
        ? "A administração aprovou a sua reserva. O convite em anexo coloca o horário na agenda do celular."
        : "Sua reserva está confirmada. O convite em anexo coloca o horário na agenda do celular.",
      details: [
        { label: "Espaço", value: booking.spaceName },
        { label: "Quando", value: period },
      ],
      ctaLabel: "Ver minhas reservas",
    },
    calendar: calendar(booking, afterApproval ? 1 : 0, false),
  });
}

/** To the booker: the request waits for the administration. */
export function requestedNotice(
  userId: string,
  booking: BookingInfo,
  timeZone: string,
): OutboxDraft {
  return draft("requested", booking, {
    userId,
    type: NotificationType.BOOKING_PENDING,
    title: `Reserva aguardando aprovação: ${booking.spaceName}`,
    body: `${formatPeriod(booking, timeZone)}. Você recebe um aviso quando a administração decidir.`,
    link: "/reservas",
    email: null,
    calendar: null,
  });
}

/** To a manager: a booking needs a decision. */
export function approvalNeededNotice(
  managerId: string,
  booking: BookingInfo,
  bookerName: string,
  timeZone: string,
): OutboxDraft {
  const period = formatPeriod(booking, timeZone);
  return draft("approval", booking, {
    userId: managerId,
    type: NotificationType.BOOKING_PENDING,
    title: `Reserva para aprovar: ${booking.spaceName}`,
    body: `${bookerName} · ${period}`,
    link: "/gestao/reservas",
    email: {
      subject: `Reserva para aprovar: ${booking.spaceName}`,
      intro: "Uma reserva aguarda a sua aprovação.",
      details: [
        { label: "Espaço", value: booking.spaceName },
        { label: "Quando", value: period },
        { label: "Quem pediu", value: bookerName },
      ],
      ctaLabel: "Analisar reservas",
    },
    calendar: null,
  });
}

/** To the booker: the administration rejected the request. */
export function rejectedNotice(
  userId: string,
  booking: BookingInfo,
  reason: string,
  timeZone: string,
): OutboxDraft {
  const period = formatPeriod(booking, timeZone);
  return draft("rejected", booking, {
    userId,
    type: NotificationType.BOOKING_REJECTED,
    title: `Reserva recusada: ${booking.spaceName}`,
    body: `${period}. Motivo: ${reason}`,
    link: "/reservas",
    email: {
      subject: `Reserva recusada: ${booking.spaceName}`,
      intro: "A administração não aprovou a sua reserva.",
      details: [
        { label: "Espaço", value: booking.spaceName },
        { label: "Quando", value: period },
        { label: "Motivo", value: reason },
      ],
      ctaLabel: "Ver minhas reservas",
    },
    calendar: null,
  });
}

/**
 * To the booker: the booking was cancelled. By a manager (with the reason)
 * or by the booker (a receipt); a confirmed booking also leaves the phone
 * calendar.
 */
export function cancelledNotice(
  userId: string,
  booking: BookingInfo,
  options: { byManager: boolean; reason: string | null; wasConfirmed: boolean },
  timeZone: string,
): OutboxDraft {
  const period = formatPeriod(booking, timeZone);
  const details = [
    { label: "Espaço", value: booking.spaceName },
    { label: "Quando", value: period },
  ];
  if (options.reason) details.push({ label: "Motivo", value: options.reason });
  return draft("cancelled", booking, {
    userId,
    type: NotificationType.BOOKING_CANCELLED,
    title: `Reserva cancelada: ${booking.spaceName}`,
    body: options.byManager
      ? `${period}. Cancelada pela administração${options.reason ? `: ${options.reason}` : "."}`
      : `${period}. Você cancelou esta reserva.`,
    link: "/reservas",
    email: {
      subject: `Reserva cancelada: ${booking.spaceName}`,
      intro: options.byManager
        ? "A administração cancelou a sua reserva."
        : "Sua reserva foi cancelada.",
      details,
      ctaLabel: "Ver minhas reservas",
    },
    calendar: options.wasConfirmed ? calendar(booking, 2, true) : null,
  });
}

/** To someone on the waiting list: the slot they wanted is free again. */
export function slotFreedNotice(
  userId: string,
  freed: BookingInfo & { spaceId: string },
  timeZone: string,
): OutboxDraft {
  const period = formatPeriod(freed, timeZone);
  return draft("freed", freed, {
    userId,
    type: NotificationType.BOOKING_SLOT_FREED,
    title: `Horário liberado: ${freed.spaceName}`,
    body: `${period}. Quem reservar primeiro fica com o horário.`,
    link: `/reservas/nova/${freed.spaceId}`,
    email: {
      subject: `Horário liberado: ${freed.spaceName}`,
      intro:
        "O horário que você esperava na lista de espera foi liberado. Quem reservar primeiro fica com ele.",
      details: [
        { label: "Espaço", value: freed.spaceName },
        { label: "Quando", value: period },
      ],
      ctaLabel: "Reservar agora",
    },
    calendar: null,
  });
}

type SeriesInfo = {
  seriesId: string;
  spaceName: string;
  first: Date;
  last: Date;
  /** Weekly bookings created. */
  count: number;
  /** Dates that could not be booked. */
  skipped: number;
};

const seriesDetails = (series: SeriesInfo, timeZone: string) => [
  { label: "Espaço", value: series.spaceName },
  { label: "Primeira", value: formatDateTime(series.first, timeZone) },
  { label: "Última", value: formatDateTime(series.last, timeZone) },
  { label: "Semanas", value: String(series.count) },
];

const seriesDraft = (
  key: string,
  series: SeriesInfo,
  delivery: NotificationDelivery,
) =>
  deliveryDraft(
    delivery,
    `series:${series.seriesId}:${key}:${delivery.userId}`,
  );

/**
 * To the booker: a weekly series was created. One notice for the whole
 * series instead of one per week.
 */
export function seriesCreatedNotice(
  userId: string,
  series: SeriesInfo,
  pending: boolean,
  timeZone: string,
): OutboxDraft {
  const skipped = series.skipped
    ? ` ${series.skipped} data${series.skipped === 1 ? "" : "s"} não pôde ser reservada.`
    : "";
  return seriesDraft("created", series, {
    userId,
    type: pending
      ? NotificationType.BOOKING_PENDING
      : NotificationType.BOOKING_CONFIRMED,
    title: pending
      ? `Reserva recorrente aguardando aprovação: ${series.spaceName}`
      : `Reserva recorrente confirmada: ${series.spaceName}`,
    body: `${series.count} semanas, de ${formatDateTime(series.first, timeZone)} a ${formatDateTime(series.last, timeZone)}.${skipped}`,
    link: "/reservas",
    email: {
      subject: pending
        ? `Reserva recorrente aguardando aprovação: ${series.spaceName}`
        : `Reserva recorrente confirmada: ${series.spaceName}`,
      intro: pending
        ? "Sua reserva semanal aguarda a aprovação da administração."
        : `Sua reserva semanal está confirmada.${skipped}`,
      details: seriesDetails(series, timeZone),
      ctaLabel: "Ver minhas reservas",
    },
    calendar: null,
  });
}

/** To a manager: a weekly series waits for a decision. */
export function seriesApprovalNotice(
  managerId: string,
  series: SeriesInfo,
  bookerName: string,
  timeZone: string,
): OutboxDraft {
  return seriesDraft("approval", series, {
    userId: managerId,
    type: NotificationType.BOOKING_PENDING,
    title: `Reserva recorrente para aprovar: ${series.spaceName}`,
    body: `${bookerName} · ${series.count} semanas a partir de ${formatDateTime(series.first, timeZone)}`,
    link: "/gestao/reservas",
    email: {
      subject: `Reserva recorrente para aprovar: ${series.spaceName}`,
      intro:
        "Uma reserva semanal aguarda a sua aprovação (cada data é aprovada separadamente).",
      details: [
        ...seriesDetails(series, timeZone),
        { label: "Quem pediu", value: bookerName },
      ],
      ctaLabel: "Analisar reservas",
    },
    calendar: null,
  });
}

/** To the booker: the remaining dates of a weekly series were cancelled. */
export function seriesCancelledNotice(
  userId: string,
  series: { seriesId: string; spaceName: string; count: number },
  byManager: boolean,
): OutboxDraft {
  const dates = `${series.count} data${series.count === 1 ? "" : "s"}`;
  return deliveryDraft(
    {
      userId,
      type: NotificationType.BOOKING_CANCELLED,
      title: `Reserva recorrente cancelada: ${series.spaceName}`,
      body: byManager
        ? `A administração cancelou ${dates} da sua reserva semanal.`
        : `Você cancelou ${dates} da sua reserva semanal.`,
      link: "/reservas",
      email: null,
      calendar: null,
    },
    `series:${series.seriesId}:cancelled:${userId}:${series.count}`,
  );
}
