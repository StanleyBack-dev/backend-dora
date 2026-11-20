import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { Parcel } from "@/modules/parcels/application/ports/parcel-repository.port";
import { formatDateTime } from "@/shared/domain/local-date";

// What the residents of a unit are told about its parcels, as outbox drafts
// stored with the change: it arrived (with the pickup code), it is still
// waiting (perishable: every few hours, and when the deadline passes), who
// picked it up, it was returned or cancelled.

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
  ...(parcel.pickupDeadline
    ? [
        {
          label: "Retirar até",
          value: formatDateTime(parcel.pickupDeadline, timeZone),
        },
      ]
    : []),
];

/** "até 20/11 às 14:30" for a perishable parcel. */
const deadline = (parcel: Parcel, timeZone: string) =>
  parcel.pickupDeadline ? formatDateTime(parcel.pickupDeadline, timeZone) : "";

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
        title: parcel.perishable
          ? "Chegou uma encomenda perecível para você"
          : "Chegou uma encomenda para você",
        body: parcel.perishable
          ? `${what(parcel)} · retire até ${deadline(parcel, timeZone)} · código ${parcel.pickupCode}`
          : `${what(parcel)} · código de retirada ${parcel.pickupCode}`,
        link: LINK,
        email: {
          subject: parcel.perishable
            ? `Encomenda perecível: retire até ${deadline(parcel, timeZone)} (código ${parcel.pickupCode})`
            : `Chegou uma encomenda para você (código ${parcel.pickupCode})`,
          intro: parcel.perishable
            ? "O condomínio recebeu uma encomenda perecível (alimento, remédio, flores…) para você. Retire dentro do prazo: mostre o QR code do app ou informe o código de retirada e assine na tela de quem entregar (portaria ou administração)."
            : "O condomínio recebeu uma encomenda para a sua unidade. Para retirar, mostre o QR code do app ou informe o código de retirada e assine na tela de quem entregar (portaria ou administração).",
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

/**
 * Perishable, still waiting: reminded every few hours until the deadline
 * (each reminder is its own notice).
 */
export function perishableReminderNotices(
  parcel: Parcel,
  userIds: readonly string[],
  timeZone: string,
  at: Date,
): OutboxDraft[] {
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.PARCEL_REMINDER,
        title: "Encomenda perecível esperando você",
        body: `${what(parcel)} · retire até ${deadline(parcel, timeZone)} · código ${parcel.pickupCode}`,
        link: LINK,
        email: {
          subject: `Retire sua encomenda perecível até ${deadline(parcel, timeZone)} (código ${parcel.pickupCode})`,
          intro:
            "Uma encomenda perecível sua ainda espera retirada no condomínio. Retire dentro do prazo para ela não estragar: mostre o QR code do app ou informe o código de retirada.",
          details: [
            { label: "Código de retirada", value: parcel.pickupCode },
            ...details(parcel, timeZone),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `parcel:${parcel.id}:perishable:${at.getTime()}:${userId}`,
    ),
  );
}

/** Perishable, past its deadline: told once (the desk decides what to do). */
export function overdueNotices(
  parcel: Parcel,
  userIds: readonly string[],
  timeZone: string,
): OutboxDraft[] {
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.PARCEL_REMINDER,
        title: "Prazo da encomenda perecível venceu",
        body: `${what(parcel)} · o prazo era ${deadline(parcel, timeZone)} · código ${parcel.pickupCode}`,
        link: LINK,
        email: {
          subject: `Prazo da encomenda perecível venceu (código ${parcel.pickupCode})`,
          intro:
            "O prazo de retirada da sua encomenda perecível venceu. Ela continua no condomínio por enquanto: retire o quanto antes ou fale com a portaria ou a administração.",
          details: [
            { label: "Código de retirada", value: parcel.pickupCode },
            ...details(parcel, timeZone),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `parcel:${parcel.id}:overdue:${userId}`,
    ),
  );
}

/**
 * To the other residents who see the parcel: someone else may now pick it
 * up (or no longer), so nobody is surprised at the desk.
 */
export function authorizedNotices(
  parcel: Parcel,
  userIds: readonly string[],
  timeZone: string,
): OutboxDraft[] {
  const granted = Boolean(parcel.authorizedName);
  const by = parcel.authorizedByName ?? "Um morador";
  return userIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.PARCEL_AUTHORIZED,
        title: granted
          ? "Retirada autorizada para outra pessoa"
          : "Autorização de retirada removida",
        body: granted
          ? `${what(parcel)} · ${parcel.authorizedName} pode retirar (autorizado por ${by})`
          : `${what(parcel)} · só os moradores podem retirar`,
        link: LINK,
        email: {
          subject: granted
            ? `Retirada autorizada: ${parcel.authorizedName} (código ${parcel.pickupCode})`
            : `Autorização de retirada removida (código ${parcel.pickupCode})`,
          intro: granted
            ? `${by} autorizou ${parcel.authorizedName} a retirar uma encomenda que você também vê. Se não reconhece esta autorização, fale com a portaria ou a administração.`
            : "A autorização para outra pessoa retirar esta encomenda foi removida.",
          details: details(parcel, timeZone),
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `parcel:${parcel.id}:authorized:${parcel.authorizedAt?.getTime() ?? "none"}:${userId}`,
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
