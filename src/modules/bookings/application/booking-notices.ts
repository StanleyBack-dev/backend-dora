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
    link: "/reservas/gestao",
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
