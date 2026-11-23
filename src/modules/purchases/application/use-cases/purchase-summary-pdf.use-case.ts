import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { Permission } from "@/modules/access-control/domain/permission";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import {
  PURCHASE_APPROVAL_REPOSITORY,
  type PurchaseApprovalRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  PURCHASE_SUMMARY_RENDERER,
  type PurchaseSummaryInput,
  type PurchaseSummaryRendererPort,
} from "@/modules/purchases/application/ports/purchase-summary-renderer.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ListPurchaseQuotesUseCase,
  paymentLine,
  type QuoteView,
} from "@/modules/purchases/application/use-cases/list-purchase-quotes.use-case";
import {
  ApprovalDecision,
  type PurchaseApproval,
} from "@/modules/purchases/domain/purchase-approval";
import {
  PurchasePriority,
  type PurchaseRequest,
  PurchaseRequestStatus,
  requestCode,
} from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "21/11/2026" from "2026-11-21". */
const day = (value: string) => value.split("-").reverse().join("/");

const PRIORITY_LABELS: Record<PurchasePriority, string> = {
  [PurchasePriority.LOW]: "Baixa",
  [PurchasePriority.NORMAL]: "Normal",
  [PurchasePriority.HIGH]: "Alta",
  [PurchasePriority.URGENT]: "Urgente",
};

const STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  [PurchaseRequestStatus.OPEN]: "Aguardando cotação",
  [PurchaseRequestStatus.QUOTING]: "Em cotação",
  [PurchaseRequestStatus.AWAITING_APPROVAL]: "Aguardando aprovação",
  [PurchaseRequestStatus.APPROVED]: "Aprovada",
  [PurchaseRequestStatus.ORDERED]: "Pedido feito",
  [PurchaseRequestStatus.RECEIVED]: "Recebida",
  [PurchaseRequestStatus.COMPLETED]: "Concluída",
  [PurchaseRequestStatus.REJECTED]: "Reprovada",
  [PurchaseRequestStatus.CANCELLED]: "Cancelada",
};

const delivery = (days: number | null) =>
  days === null
    ? null
    : days === 0
      ? "Imediato"
      : days === 1
        ? "1 dia"
        : `${days} dias`;

const quoteName = (quote: { supplierName: string; totalCents: number }) =>
  `${quote.supplierName} (${money(quote.totalCents)})`;

// The purchase summary (resumo da compra) as a PDF: where the purchase
// stands, the request, every quote in one line, the chosen one, the
// timeline (asked, quoted, chosen, returned, decided) and lines to sign.
// Read by the management and the approvers.
@Injectable()
export class PurchaseSummaryPdfUseCase {
  constructor(
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    @Inject(PURCHASE_APPROVAL_REPOSITORY)
    private readonly approvals: PurchaseApprovalRepositoryPort,
    private readonly listing: ListPurchaseQuotesUseCase,
    private readonly access: PurchasesAccessService,
    private readonly condominiums: CondominiumLookupService,
    @Inject(PURCHASE_SUMMARY_RENDERER)
    private readonly renderer: PurchaseSummaryRendererPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  private when(date: Date): string {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: this.clock.timeZone,
    }).format(date);
  }

  async render(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<{ fileName: string; content: Buffer }> {
    const condominiumId = await this.access.condominiumWithAny(
      actor,
      Permission.PURCHASES_MANAGE,
      Permission.PURCHASES_APPROVE,
    );
    const request = await this.requests.find(condominiumId, requestId);
    if (!request) {
      throw AppException.from(APP_ERRORS.purchases.requestNotFound, undefined);
    }
    const [quotes, history, condominium] = await Promise.all([
      this.listing.list(actor, request.id),
      this.approvals.history(request.id),
      this.condominiums.find(condominiumId),
    ]);
    const code = requestCode(request.number);
    const content = await this.renderer.render(
      this.input(request, quotes, history, {
        code,
        condominiumName: condominium?.name ?? "Condomínio",
      }),
    );
    return { fileName: `resumo-da-compra-${code}.pdf`, content };
  }

  /** The summary as text (exposed for the tests). */
  input(
    request: PurchaseRequest,
    quotes: QuoteView[],
    history: PurchaseApproval[],
    meta: { code: string; condominiumName: string },
  ): PurchaseSummaryInput {
    const chosen = quotes.find((quote) => quote.chosen) ?? null;
    const latest = history[0] ?? null;
    const ranked = [...quotes].sort(
      (a, b) =>
        Number(b.complete) - Number(a.complete) || a.totalCents - b.totalCents,
    );

    const approvedBy =
      request.status === PurchaseRequestStatus.APPROVED ||
      request.status === PurchaseRequestStatus.REJECTED
        ? latest
        : null;

    return {
      code: meta.code,
      title: request.title,
      condominiumName: meta.condominiumName,
      generatedAt: this.when(this.clock.now()),
      statusLabel: STATUS_LABELS[request.status],
      status: this.status(request, chosen, latest, quotes.length),
      facts: [
        ["Solicitada por", request.requestedByName],
        ["Em", this.when(request.createdAt)],
        ["Prioridade", PRIORITY_LABELS[request.priority]],
        ["Precisa até", request.neededBy ? day(request.neededBy) : null],
        ["Onde vai ser usado", request.location],
      ],
      details: request.description,
      items: request.items.map((item) => ({
        label: [item.productName, item.brandName, item.note]
          .filter(Boolean)
          .join(" · "),
        quantity: `${item.quantity.toLocaleString("pt-BR")} ${item.unit}`,
      })),
      quotes: ranked.map((quote) => ({
        supplier: quote.supplierName,
        line: [
          money(quote.totalCents),
          quote.complete ? "completa" : "parcial (faltam itens)",
          quote.cheapest ? "mais barata" : null,
          quote.chosen ? "escolhida" : null,
          paymentLine(quote),
          delivery(quote.deliveryDays)
            ? `entrega: ${delivery(quote.deliveryDays)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
      choice: chosen
        ? {
            supplier: chosen.supplierName,
            facts: [
              ["Total", money(chosen.totalCents)],
              ["Pagamento", paymentLine(chosen)],
              ["Entrega", delivery(chosen.deliveryDays)],
              ["Validade", chosen.validUntil ? day(chosen.validUntil) : null],
              [
                "Escolhida por",
                request.chosenByName
                  ? `${request.chosenByName}${request.chosenAt ? ` em ${this.when(request.chosenAt)}` : ""}`
                  : null,
              ],
              ["Justificativa", request.choiceJustification],
            ],
          }
        : null,
      timeline: this.timeline(request, quotes, history, chosen),
      signers: chosen
        ? [
            { name: request.chosenByName ?? "", role: "Escolhida por" },
            {
              name:
                approvedBy &&
                approvedBy.decision !== ApprovalDecision.AUTO_APPROVED
                  ? (approvedBy.decidedByName ?? "")
                  : "",
              role:
                request.status === PurchaseRequestStatus.REJECTED
                  ? "Reprovada por"
                  : "Aprovada por",
            },
          ]
        : [],
    };
  }

  private status(
    request: PurchaseRequest,
    chosen: QuoteView | null,
    latest: PurchaseApproval | null,
    quoteCount: number,
  ): PurchaseSummaryInput["status"] {
    const by = (approval: PurchaseApproval) =>
      `${approval.decidedByName ?? "—"} em ${this.when(approval.decidedAt)}`;
    const note = (label: string, text: string | null) =>
      text ? ` ${label}: ${text}` : "";
    switch (request.status) {
      case PurchaseRequestStatus.APPROVED:
        if (latest?.decision === ApprovalDecision.AUTO_APPROVED) {
          return {
            tone: "good",
            line: `Aprovada na alçada${latest.limitCents !== null ? ` (até ${money(latest.limitCents)})` : ""}: ${quoteName(latest)}, ao ser escolhida em ${this.when(latest.decidedAt)}.`,
          };
        }
        return {
          tone: "good",
          line: `Aprovada${latest ? ` por ${by(latest)}` : ""}: ${chosen ? quoteName(chosen) : "—"}.${note("Observação", latest?.note ?? null)}`,
        };
      case PurchaseRequestStatus.REJECTED:
        return {
          tone: "bad",
          line: `Reprovada${latest ? ` por ${by(latest)}` : ""}.${note("Motivo", latest?.note ?? null)}`,
        };
      case PurchaseRequestStatus.CANCELLED:
        return {
          tone: "bad",
          line: `Cancelada${request.cancelledAt ? ` em ${this.when(request.cancelledAt)}` : ""}.${note("Motivo", request.cancelReason)}`,
        };
      case PurchaseRequestStatus.AWAITING_APPROVAL:
        return {
          tone: "waiting",
          line: `Aguardando aprovação: ${chosen ? quoteName(chosen) : "—"}, escolhida por ${request.chosenByName ?? "—"}.`,
        };
      case PurchaseRequestStatus.QUOTING:
        return latest?.decision === ApprovalDecision.RETURNED
          ? {
              tone: "info",
              line: `Devolvida para cotação por ${by(latest)}.${note("Motivo", latest.note)}`,
            }
          : {
              tone: "info",
              line: `Em cotação: ${quoteCount} ${quoteCount === 1 ? "cotação registrada" : "cotações registradas"}, nenhuma escolhida ainda.`,
            };
      default:
        return { tone: "info", line: STATUS_LABELS[request.status] };
    }
  }

  private timeline(
    request: PurchaseRequest,
    quotes: QuoteView[],
    history: PurchaseApproval[],
    chosen: QuoteView | null,
  ): { at: string; event: string }[] {
    const events: { at: Date; event: string }[] = [
      {
        at: request.createdAt,
        event: `Solicitação feita por ${request.requestedByName}.`,
      },
      ...quotes.map((quote) => ({
        at: quote.createdAt,
        event: `Cotação de ${quoteName(quote)} registrada.`,
      })),
      ...history.map((approval) => {
        const chose = `escolhida por ${approval.chosenByName ?? "—"}`;
        const event = {
          [ApprovalDecision.AUTO_APPROVED]: `${quoteName(approval)} ${chose} e aprovada na alçada${approval.limitCents !== null ? ` (até ${money(approval.limitCents)})` : ""}.`,
          [ApprovalDecision.APPROVED]: `${quoteName(approval)} (${chose}) aprovada por ${approval.decidedByName ?? "—"}.${approval.note ? ` Observação: ${approval.note}` : ""}`,
          [ApprovalDecision.RETURNED]: `${quoteName(approval)} (${chose}) devolvida para cotação por ${approval.decidedByName ?? "—"}. Motivo: ${approval.note ?? "—"}`,
          [ApprovalDecision.REJECTED]: `${quoteName(approval)} (${chose}) reprovada por ${approval.decidedByName ?? "—"}. Motivo: ${approval.note ?? "—"}`,
        }[approval.decision];
        return { at: approval.decidedAt, event };
      }),
    ];
    if (
      request.status === PurchaseRequestStatus.AWAITING_APPROVAL &&
      chosen &&
      request.chosenAt
    ) {
      events.push({
        at: request.chosenAt,
        event: `${quoteName(chosen)} escolhida por ${request.chosenByName ?? "—"}; aguarda aprovação.`,
      });
    }
    if (request.cancelledAt) {
      events.push({
        at: request.cancelledAt,
        event: `Solicitação cancelada.${request.cancelReason ? ` Motivo: ${request.cancelReason}` : ""}`,
      });
    }
    return events
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map(({ at, event }) => ({ at: this.when(at), event }));
  }
}
