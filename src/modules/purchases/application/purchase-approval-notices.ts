import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import {
  ApprovalDecision,
  type NewApproval,
} from "@/modules/purchases/domain/purchase-approval";
import {
  type PurchaseRequest,
  requestCode,
} from "@/modules/purchases/domain/purchase-request";
import { formatCents } from "@/shared/domain/money";

/** The purchase's approval page (the management and the approvers). */
const approvalLink = (request: PurchaseRequest) =>
  `/compras/aprovacoes/${request.id}`;

/** The requests list showing that one request, open. */
const requestLink = (request: PurchaseRequest) =>
  `/compras/solicitacoes?solicitacao=${request.id}&situacao=todas`;

const WORDS: Record<
  Exclude<ApprovalDecision, ApprovalDecision.AUTO_APPROVED>,
  { type: NotificationType; title: string; verb: string }
> = {
  [ApprovalDecision.APPROVED]: {
    type: NotificationType.PURCHASE_APPROVED,
    title: "aprovada",
    verb: "aprovou",
  },
  [ApprovalDecision.RETURNED]: {
    type: NotificationType.PURCHASE_RETURNED,
    title: "devolvida para cotação",
    verb: "devolveu para cotação",
  },
  [ApprovalDecision.REJECTED]: {
    type: NotificationType.PURCHASE_REJECTED,
    title: "reprovada",
    verb: "reprovou",
  },
};

/** A chosen quote waits: the approvers (but whoever chose it) are told. */
export function approvalRequestedNotices(
  request: PurchaseRequest,
  approval: Pick<NewApproval, "supplierName" | "totalCents" | "limitCents">,
  chosenBy: { id: string; name: string },
  approvers: readonly string[],
  at: Date,
): OutboxDraft[] {
  const code = requestCode(request.number);
  const why =
    approval.limitCents === null
      ? "Toda compra passa por aprovação."
      : `Acima da alçada de ${formatCents(approval.limitCents)}.`;
  return approvers
    .filter((userId) => userId !== chosenBy.id)
    .map((userId) =>
      deliveryDraft(
        {
          userId,
          type: NotificationType.PURCHASE_APPROVAL_REQUESTED,
          title: `Compra ${code} aguarda a sua aprovação`,
          body: `${chosenBy.name} escolheu ${approval.supplierName} (${formatCents(approval.totalCents)}) para “${request.title}”. ${why}`,
          link: approvalLink(request),
          email: {
            subject: `Compra aguardando aprovação: ${request.title}`,
            intro: `${chosenBy.name} escolheu uma cotação que precisa da sua aprovação. ${why}`,
            details: [
              { label: "Solicitação", value: `${code} · ${request.title}` },
              { label: "Fornecedor", value: approval.supplierName },
              { label: "Total", value: formatCents(approval.totalCents) },
            ],
            ctaLabel: "Ver e decidir",
          },
          calendar: null,
        },
        `purchase-request:${request.id}:approval-requested:${userId}:${at.getTime()}`,
      ),
    );
}

/**
 * A decision was made: whoever asked for it and the managers (but whoever
 * decided) are told. Within the limit, it reads "aprovada na alçada".
 */
export function approvalDecidedNotices(
  request: PurchaseRequest,
  approval: NewApproval,
  decidedBy: { id: string; name: string },
  managers: readonly string[],
): OutboxDraft[] {
  const code = requestCode(request.number);
  const auto = approval.decision === ApprovalDecision.AUTO_APPROVED;
  const words =
    WORDS[
      approval.decision === ApprovalDecision.AUTO_APPROVED
        ? ApprovalDecision.APPROVED
        : approval.decision
    ];
  const recipients = [...new Set([request.requestedById, ...managers])].filter(
    (userId) => userId !== decidedBy.id,
  );
  const body = auto
    ? `“${request.title}” foi aprovada dentro da alçada: ${approval.supplierName}, ${formatCents(approval.totalCents)}.`
    : `${decidedBy.name} ${words.verb} “${request.title}” (${approval.supplierName}, ${formatCents(approval.totalCents)}).${approval.note ? ` ${approval.decision === ApprovalDecision.APPROVED ? "Observação" : "Motivo"}: ${approval.note}` : ""}`;
  return recipients.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: words.type,
        title: `Compra ${code} ${words.title}`,
        body,
        link:
          userId === request.requestedById && !managers.includes(userId)
            ? requestLink(request)
            : approvalLink(request),
        email: {
          subject: `Compra ${words.title}: ${request.title}`,
          intro: body,
          details: [
            { label: "Solicitação", value: `${code} · ${request.title}` },
            { label: "Fornecedor", value: approval.supplierName },
            { label: "Total", value: formatCents(approval.totalCents) },
            ...(approval.note
              ? [
                  {
                    label:
                      approval.decision === ApprovalDecision.APPROVED
                        ? "Observação"
                        : "Motivo",
                    value: approval.note,
                  },
                ]
              : []),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `purchase-request:${request.id}:${approval.decision.toLowerCase()}:${userId}:${approval.decidedAt.getTime()}`,
    ),
  );
}
