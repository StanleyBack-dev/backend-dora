import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { Parcel } from "@/modules/parcels/application/ports/parcel-repository.port";
import { formatDateTime } from "@/shared/domain/local-date";

// What the residents of a unit are told about its parcels, as outbox drafts
// stored with the change: it arrived (with the pickup code), it is still
// waiting, who picked it up, it was returned or cancelled.

const LINK = "/encomendas/minhas";

const what = (parcel: Parcel) =>
  [parcel.carrier, parcel.recipientName ? `para ${parcel.recipientName}` : null]
    .filter(Boolean)
    .join(" · ") || "Encomenda";

const details = (parcel: Parcel, timeZone: string) => [
  ...(parcel.unitLabel ? [{ label: "Unidade", value: parcel.unitLabel }] : []),
  ...(parcel.recipientName
    ? [{ label: "Destinatário", value: parcel.recipientName }]
    : []),
  ...(parcel.carrier
    ? [{ label: "Transportadora", value: parcel.carrier }]
    : []),
  ...(parcel.trackingCode
    ? [{ label: "Rastreio", value: parcel.trackingCode }]
    : []),
  {
    label: "Recebida em",
    value: formatDateTime(parcel.receivedAt, timeZone),
  },
];

/** To each resident of the unit: a parcel arrived, with the pickup code. */
export function receivedNotices(
  parcel: Parcel,
  userIds: readonly string[],
  timeZone: string,
): OutboxDraft[] {
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.PARCEL_RECEIVED,
        title: "Chegou uma encomenda para você",
        body: `${what(parcel)} · código de retirada ${parcel.pickupCode}`,
        link: LINK,
        email: {
          subject: `Chegou uma encomenda para você (código ${parcel.pickupCode})`,
          intro:
            "O condomínio recebeu uma encomenda para a sua unidade. Para retirar, mostre o QR code do app ou informe o código de retirada e assine na tela de quem entregar (portaria ou administração).",
          details: [
            { label: "Código de retirada", value: parcel.pickupCode },
            ...details(parcel, timeZone),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `parcel:${parcel.id}:received:${userId}`,
    ),
  );
}

/** To each resident of the unit: the parcel is still at the gate. */
export function reminderNotices(
  parcel: Parcel,
  userIds: readonly string[],
  timeZone: string,
): OutboxDraft[] {
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.PARCEL_REMINDER,
        title: "Sua encomenda ainda espera retirada",
        body: `${what(parcel)} · código de retirada ${parcel.pickupCode}`,
        link: LINK,
        email: {
          subject: `Sua encomenda ainda espera retirada (código ${parcel.pickupCode})`,
          intro:
            "Uma encomenda da sua unidade ainda espera retirada no condomínio. Retire assim que puder: mostre o QR code do app ou informe o código de retirada.",
          details: [
            { label: "Código de retirada", value: parcel.pickupCode },
            ...details(parcel, timeZone),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `parcel:${parcel.id}:reminder:${userId}`,
    ),
  );
}

/** To each resident of the unit: the parcel was picked up, by whom. */
export function pickedUpNotices(
  parcel: Parcel,
  userIds: readonly string[],
  timeZone: string,
): OutboxDraft[] {
  const when = parcel.closedAt ? formatDateTime(parcel.closedAt, timeZone) : "";
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.PARCEL_PICKED_UP,
        title: "Encomenda retirada",
        body: `${what(parcel)} · retirada por ${parcel.signerName ?? "—"} em ${when}`,
        link: LINK,
        email: {
          subject: `Encomenda retirada (código ${parcel.pickupCode})`,
          intro:
            "Uma encomenda da sua unidade foi retirada, com assinatura na tela. Se não foi você nem alguém da sua confiança, fale com a administração.",
          details: [
            { label: "Retirada por", value: parcel.signerName ?? "—" },
            { label: "Retirada em", value: when },
            ...details(parcel, timeZone),
          ],
          ctaLabel: "Ver o comprovante",
        },
        calendar: null,
      },
      `parcel:${parcel.id}:picked-up:${userId}`,
    ),
  );
}

/** To each resident of the unit: the parcel was returned or cancelled. */
export function closedNotices(
  parcel: Parcel,
  userIds: readonly string[],
  timeZone: string,
): OutboxDraft[] {
  const returned = parcel.status === "RETURNED";
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: returned
          ? NotificationType.PARCEL_RETURNED
          : NotificationType.PARCEL_CANCELLED,
        title: returned
          ? "Encomenda devolvida ao remetente"
          : "Aviso de encomenda cancelado",
        body: `${what(parcel)} · ${parcel.closeReason ?? ""}`,
        link: LINK,
        email: {
          subject: returned
            ? `Encomenda devolvida (código ${parcel.pickupCode})`
            : `Aviso de encomenda cancelado (código ${parcel.pickupCode})`,
          intro: returned
            ? "Uma encomenda da sua unidade foi devolvida ao remetente pelo condomínio. Em caso de dúvida, fale com a administração."
            : "O aviso de encomenda enviado antes foi registrado por engano e foi cancelado. Desconsidere o código de retirada.",
          details: [
            { label: "Motivo", value: parcel.closeReason ?? "—" },
            ...details(parcel, timeZone),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `parcel:${parcel.id}:closed:${userId}`,
    ),
  );
}
