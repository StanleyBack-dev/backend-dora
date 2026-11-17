import {
  RELATIONSHIP_LABELS,
  type Dependent,
} from "@/modules/dependents/domain/dependent";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

// What people are told about dependents, stored with the change: the
// managers when one waits for review, the resident when it was decided.

/** To each manager: a dependent waits for review. */
export function submittedNotices(
  dependent: Pick<
    Dependent,
    "name" | "relationship" | "holderName" | "unitLabel"
  >,
  managerIds: readonly string[],
  key: string,
): OutboxDraft[] {
  const who = `${dependent.name} (${RELATIONSHIP_LABELS[dependent.relationship]})`;
  const holder = [dependent.holderName, dependent.unitLabel]
    .filter(Boolean)
    .join(" · ");
  return managerIds.map((userId) =>
    deliveryDraft(
      {
        userId,
        type: NotificationType.DEPENDENT_SUBMITTED,
        title: "Dependente para aprovar",
        body: holder ? `${who} · ${holder}` : who,
        link: "/gestao/dependentes",
        email: {
          subject: "Dependente para aprovar",
          intro:
            "Um morador cadastrou um dependente. Confira o documento com a data de nascimento e aprove ou recuse no app.",
          details: [
            { label: "Dependente", value: who },
            ...(holder ? [{ label: "Morador", value: holder }] : []),
          ],
          ctaLabel: "Conferir no app",
        },
        calendar: null,
      },
      `dependent:${key}:submitted:${userId}`,
    ),
  );
}

/** To the resident: the dependent was approved or rejected. */
export function decidedNotice(
  dependent: Dependent,
  userId: string,
): OutboxDraft[] {
  const approved = dependent.status === "APPROVED";
  return [
    deliveryDraft(
      {
        userId,
        type: approved
          ? NotificationType.DEPENDENT_APPROVED
          : NotificationType.DEPENDENT_REJECTED,
        title: approved
          ? `Dependente aprovado: ${dependent.name}`
          : `Dependente recusado: ${dependent.name}`,
        body: approved
          ? "Já pode escolher nos pedidos de ingressos."
          : (dependent.rejectReason ?? ""),
        link: "/perfil/dependentes",
        email: {
          subject: approved
            ? `Dependente aprovado: ${dependent.name}`
            : `Dependente recusado: ${dependent.name}`,
          intro: approved
            ? "A administração conferiu o documento. O dependente já pode ser escolhido nos pedidos de ingressos dos eventos."
            : "A administração não aprovou o dependente. Confira o motivo e cadastre de novo com o documento certo.",
          details: [
            { label: "Dependente", value: dependent.name },
            ...(approved
              ? []
              : [{ label: "Motivo", value: dependent.rejectReason ?? "—" }]),
          ],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `dependent:${dependent.id}:${dependent.status}`,
    ),
  ];
}
