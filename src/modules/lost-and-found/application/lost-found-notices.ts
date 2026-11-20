import type {
  FoundItem,
  FoundItemClaim,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  CATEGORY_LABELS,
  ClaimStatus,
} from "@/modules/lost-and-found/domain/found-item";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { formatDateTime } from "@/shared/domain/local-date";

// What the staff and the residents are told about found items, as outbox
// drafts stored with the change: a claim arrived (staff), it was accepted
// or rejected, the item was handed over, the keeping period is ending.

const DESK = "/achados-e-perdidos";
const MINE = "/achados-e-perdidos/meus";

const itemDetails = (
  item: Pick<FoundItem, "category" | "foundLocation" | "foundAt">,
  timeZone: string,
) => [
  { label: "Categoria", value: CATEGORY_LABELS[item.category] },
  { label: "Achado em", value: item.foundLocation },
  { label: "Data", value: formatDateTime(item.foundAt, timeZone) },
];

/** To the staff: a resident says the item is theirs. */
export function claimedNotices(
  claim: FoundItemClaim,
  staff: readonly string[],
): OutboxDraft[] {
  const who = claim.unitLabel
    ? `${claim.userName} (${claim.unitLabel})`
    : claim.userName;
  return staff.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.FOUND_ITEM_CLAIMED,
        title: "Pedido de item achado",
        body: `${who} diz que “${claim.itemTitle}” é seu.`,
        link: DESK,
        email: {
          subject: `Pedido de item achado: ${claim.itemTitle}`,
          intro: `${who} diz que este item achado é seu. Confira a descrição com os detalhes do item e aceite ou recuse o pedido no app.`,
          details: [
            { label: "Item", value: claim.itemTitle },
            { label: "Descrição do morador", value: claim.message },
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `found-claim:${claim.id}:claimed:${userId}`,
    ),
  );
}

/** To whoever claimed it: accepted (come and take it) or rejected. */
export function decidedNotices(claim: FoundItemClaim): OutboxDraft[] {
  const accepted = claim.status === ClaimStatus.ACCEPTED;
  return [
    deliveryDraft(
      {
        userId: claim.userId,
        type: NotificationType.FOUND_ITEM_CLAIM_DECIDED,
        title: accepted
          ? "Seu item achado está esperando você"
          : "Pedido de item achado recusado",
        body: accepted
          ? `“${claim.itemTitle}”: retire na portaria ou na administração e assine na tela.`
          : `“${claim.itemTitle}”: ${claim.decisionNote ?? "o pedido não foi aceito."}`,
        link: MINE,
        email: {
          subject: accepted
            ? `Seu item achado está esperando você: ${claim.itemTitle}`
            : `Pedido de item achado recusado: ${claim.itemTitle}`,
          intro: accepted
            ? "O condomínio confirmou que o item é seu. Retire na portaria ou na administração: quem entregar vai pedir sua assinatura na tela."
            : "O pedido deste item achado não foi aceito. Em caso de dúvida, fale com a portaria ou a administração.",
          details: [
            { label: "Item", value: claim.itemTitle },
            ...(claim.decisionNote
              ? [{ label: "Observação", value: claim.decisionNote }]
              : []),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `found-claim:${claim.id}:${claim.status.toLowerCase()}`,
    ),
  ];
}

/** To the resident it went back to: handed over, with the receipt. */
export function returnedNotices(
  item: FoundItem,
  timeZone: string,
): OutboxDraft[] {
  if (!item.returnedToId) return [];
  const when = item.closedAt ? formatDateTime(item.closedAt, timeZone) : "";
  return [
    deliveryDraft(
      {
        userId: item.returnedToId,
        type: NotificationType.FOUND_ITEM_RETURNED,
        title: "Item achado devolvido",
        body: `“${item.title}” · retirado por ${item.signerName ?? "—"} em ${when}`,
        link: MINE,
        email: {
          subject: `Item achado devolvido: ${item.title}`,
          intro:
            "O item que você pediu foi entregue, com assinatura na tela. Se não foi você nem alguém da sua confiança, fale com a administração.",
          details: [
            { label: "Retirado por", value: item.signerName ?? "—" },
            { label: "Retirado em", value: when },
            ...itemDetails(item, timeZone),
          ],
          ctaLabel: "Ver o comprovante",
        },
        calendar: null,
      },
      `found-item:${item.id}:returned`,
    ),
  ];
}

/** To the staff: the keeping period of a kept item is ending. */
export function expiringNotices(
  item: FoundItem,
  staff: readonly string[],
  timeZone: string,
): OutboxDraft[] {
  const until = formatDateTime(item.keepUntil, timeZone);
  return staff.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.FOUND_ITEM_EXPIRING,
        title: "Prazo de guarda terminando",
        body: `“${item.title}” fica guardado até ${until}: depois, doe ou descarte.`,
        link: DESK,
        email: {
          subject: `Prazo de guarda terminando: ${item.title}`,
          intro: `Este item achado está guardado até ${until} e ninguém o retirou. Depois do prazo, registre a doação ou o descarte no app.`,
          details: [
            { label: "Item", value: item.title },
            { label: "Guardado em", value: item.storageLocation },
            ...itemDetails(item, timeZone),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `found-item:${item.id}:expiring:${userId}`,
    ),
  );
}
