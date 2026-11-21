import type { LostReport } from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import { deliveryDraft } from "@/modules/notifications/application/notification-delivery";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

/** The desk's list of what residents are looking for. */
const LOST_REPORTS_DESK = "/achados-e-perdidos/procurados";
/** The resident's own "Perdi algo" reports. */
const MY_LOST_REPORTS = "/achados-e-perdidos/perdi";

/** "Perdi algo" ended without news: report again if still looking. */
export function expiredReportNotices(report: LostReport): OutboxDraft[] {
  return [
    deliveryDraft(
      {
        userId: report.userId,
        type: NotificationType.LOST_REPORT_EXPIRED,
        title: "Aviso de item perdido encerrado",
        body: `O aviso de “${report.title}” foi encerrado depois de 90 dias sem notícias. Se ainda procura, avise de novo em “Perdi algo”.`,
        link: MY_LOST_REPORTS,
        email: {
          subject: `Aviso de item perdido encerrado: ${report.title}`,
          intro:
            "O seu aviso de “Perdi algo” ficou 90 dias sem notícias e foi encerrado. Se ainda procura o item, crie um novo aviso no app.",
          details: [{ label: "Item", value: report.title }],
          ctaLabel: "Ver no app",
        },
        calendar: null,
      },
      `lost-report:${report.id}:expired`,
    ),
  ];
}

/**
 * "Achei isso": a neighbour says they found what was reported lost. The
 * owner is told (not who: the desk mediates) and the desk is told who, to
 * expect it. Once per neighbour and report (dedupe keys).
 */
export function spottedNotices(
  report: LostReport,
  finder: { id: string; name: string },
  note: string | null,
  staff: readonly string[],
): OutboxDraft[] {
  const owner = deliveryDraft(
    {
      userId: report.userId,
      type: NotificationType.LOST_REPORT_SPOTTED,
      title: "Um vizinho achou o que você perdeu",
      body: `Um vizinho diz que achou “${report.title}” e vai deixar na portaria.${note ? ` Recado: ${note}` : ""}`,
      link: MY_LOST_REPORTS,
      email: {
        subject: `Um vizinho achou: ${report.title}`,
        intro:
          "Um vizinho viu o seu aviso no mural e diz que achou o que você perdeu. Ele foi orientado a deixar na portaria: confira lá com um documento.",
        details: [
          { label: "Item", value: report.title },
          ...(note ? [{ label: "Recado do vizinho", value: note }] : []),
        ],
        ctaLabel: "Ver no app",
      },
      calendar: null,
    },
    `lost-report:${report.id}:spotted:${finder.id}:owner`,
  );
  const desk = staff
    .filter((userId) => userId !== finder.id && userId !== report.userId)
    .map((userId) =>
      deliveryDraft(
        {
          userId,
          type: NotificationType.LOST_REPORT_SPOTTED,
          title: "Item procurado foi achado",
          body: `${finder.name} diz que achou “${report.title}”, procurado por ${report.userName}. Registre quando for entregue.`,
          link: LOST_REPORTS_DESK,
          email: {
            subject: `Item procurado foi achado: ${report.title}`,
            intro: `${finder.name} diz que achou um item que ${report.userName} avisou ter perdido e foi orientado a deixar na portaria. Quando chegar, registre o item e devolva com assinatura.`,
            details: [
              { label: "Item", value: report.title },
              { label: "Procurado por", value: report.userName },
              { label: "Achado por", value: finder.name },
              ...(note ? [{ label: "Recado", value: note }] : []),
            ],
            ctaLabel: "Ver no app",
          },
          calendar: null,
        },
        `lost-report:${report.id}:spotted:${finder.id}:${userId}`,
      ),
    );
  return [owner, ...desk];
}
