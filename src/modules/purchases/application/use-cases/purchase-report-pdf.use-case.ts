import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CATEGORY_LABELS } from "@/modules/catalog/domain/category";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import {
  PURCHASE_INDICATORS_REPOSITORY,
  type PurchaseIndicatorsRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-indicators-repository.port";
import {
  PURCHASE_REPORT_RENDERER,
  type PurchaseReportInput,
  type PurchaseReportRendererPort,
  type ReportTable,
} from "@/modules/purchases/application/ports/purchase-report-renderer.port";
import { PurchaseIndicatorsUseCase } from "@/modules/purchases/application/use-cases/purchase-indicators.use-case";
import { PurchaseTransparencyUseCase } from "@/modules/purchases/application/use-cases/purchase-transparency.use-case";
import {
  type CategorySpend,
  type IndicatorPeriod,
  type MonthSpend,
  periodRange,
} from "@/modules/purchases/domain/purchase-indicators";
import { requestCode } from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { formatDateTime, formatLocalDate } from "@/shared/domain/local-date";
import { formatCents } from "@/shared/domain/money";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** At most this many purchases listed in the accounts' PDF. */
const MAX_LISTED = 500;

export type PurchaseReportFile = { fileName: string; content: Buffer };

const periodLabel = (period: IndicatorPeriod) =>
  period.month === null
    ? `Ano de ${period.year}`
    : `${MONTHS[period.month - 1]} de ${period.year}`;

const periodSlug = (period: IndicatorPeriod) =>
  period.month === null
    ? String(period.year)
    : `${period.year}-${String(period.month).padStart(2, "0")}`;

const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : part / whole;

const percentLabel = (share: number) =>
  `${(share * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const count = (value: number, one: string, many: string) =>
  `${value} ${value === 1 ? one : many}`;

function categoryTable(rows: CategorySpend[], paid: number): ReportTable {
  return {
    title: "Gasto por categoria",
    columns: [
      { label: "Categoria", width: 3 },
      { label: "Compras", width: 1, align: "right" },
      { label: "Pago", width: 1.4, align: "right" },
      { label: "Participação", width: 3 },
    ],
    rows: rows.map((row) => {
      const share = percent(row.cents, paid);
      return [
        CATEGORY_LABELS[row.category],
        String(row.purchases),
        formatCents(row.cents),
        { bar: share, label: percentLabel(share) },
      ];
    }),
    note: "Uma compra com mais de uma categoria tem o valor dividido entre elas.",
  };
}

function monthTable(rows: MonthSpend[], year: number): ReportTable {
  const top = Math.max(...rows.map((row) => row.cents), 0);
  return {
    title: `Gasto por mês (${year})`,
    columns: [
      { label: "Mês", width: 2 },
      { label: "Pago", width: 1.4, align: "right" },
      { label: "", width: 4.6 },
    ],
    rows: rows.map((row) => [
      MONTHS[row.month - 1],
      formatCents(row.cents),
      { bar: percent(row.cents, top), label: "" },
    ]),
  };
}

/**
 * The purchases reports as A4 landscape PDFs: the management's indicators
 * (spend by category, month and supplier, what is owed and the process
 * figures) and the residents' accounts (spend by category and month and the
 * purchases completed). Each reads through its use case, so the same
 * access rules apply.
 */
@Injectable()
export class PurchaseReportPdfUseCase {
  constructor(
    private readonly indicatorsOf: PurchaseIndicatorsUseCase,
    private readonly transparencyOf: PurchaseTransparencyUseCase,
    @Inject(PURCHASE_INDICATORS_REPOSITORY)
    private readonly figures: PurchaseIndicatorsRepositoryPort,
    @Inject(PURCHASE_REPORT_RENDERER)
    private readonly renderer: PurchaseReportRendererPort,
    private readonly condominiums: CondominiumLookupService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async indicators(
    actor: AuthenticatedUser,
    period: IndicatorPeriod,
  ): Promise<PurchaseReportFile> {
    const data = await this.indicatorsOf.indicators(actor, period);
    const process = data.process;
    const input: PurchaseReportInput = {
      ...(await this.header(actor, period)),
      label: "Indicadores de compras",
      title: "Indicadores de compras",
      stats: [
        {
          label: "Pago no período",
          value: formatCents(data.paidCents),
          hint: count(data.purchases, "compra", "compras"),
        },
        {
          label: "Comprometido",
          value: formatCents(data.committed.cents),
          hint: `${count(data.committed.installments, "parcela", "parcelas")} a pagar hoje`,
        },
        {
          label: "Economia",
          value: formatCents(process.savingsCents),
          hint: "frente à maior cotação",
        },
        {
          label: "Pedidos feitos",
          value: String(process.orders),
          hint: `${process.withThreeQuotes} com 3 ou mais cotações`,
        },
      ],
      facts: {
        title: "Processo (pedidos feitos no período)",
        rows: [
          ["Pedidos feitos", String(process.orders)],
          [
            "Com 3 ou mais cotações",
            `${process.withThreeQuotes} de ${process.orders}`,
          ],
          [
            "Economia frente à maior cotação",
            formatCents(process.savingsCents),
          ],
          ["Da solicitação ao pedido", days(process.avgDaysToOrder)],
          ["Do pedido à entrega", days(process.avgDaysToDeliver)],
          ["Entregas atrasadas", String(process.lateDeliveries)],
        ],
      },
      tables: [
        categoryTable(data.byCategory, data.paidCents),
        monthTable(data.byMonth, period.year),
        {
          title: "Por fornecedor",
          columns: [
            { label: "Fornecedor", width: 3 },
            { label: "Compras", width: 1, align: "right" },
            { label: "Pago", width: 1.4, align: "right" },
            { label: "Avaliação", width: 1.4, align: "right" },
            { label: "Participação", width: 2.6 },
          ],
          rows: data.bySupplier.map((row) => {
            const share = percent(row.cents, data.paidCents);
            return [
              row.supplierName,
              String(row.purchases),
              formatCents(row.cents),
              row.ratingAverage === null
                ? "—"
                : `${row.ratingAverage.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} de 5 (${row.ratingCount})`,
              { bar: share, label: percentLabel(share) },
            ];
          }),
        },
      ],
    };
    return {
      fileName: `indicadores-de-compras-${periodSlug(period)}.pdf`,
      content: await this.renderer.render(input),
    };
  }

  async transparency(
    actor: AuthenticatedUser,
    period: IndicatorPeriod,
  ): Promise<PurchaseReportFile> {
    const summary = await this.transparencyOf.summary(actor, period);
    const condominiumId = await this.transparencyOf.open(actor, period);
    const listed = await this.figures.completed(
      condominiumId,
      periodRange(period),
      { page: 1, limit: MAX_LISTED },
    );
    const input: PurchaseReportInput = {
      ...(await this.header(actor, period)),
      label: "Prestação de contas",
      title: "Prestação de contas · Compras",
      stats: [
        {
          label: "Pago no período",
          value: formatCents(summary.paidCents),
          hint: count(summary.purchases, "compra", "compras"),
        },
        {
          label: "Compras concluídas",
          value: String(listed.total),
          hint: "recebidas e pagas",
        },
        {
          label: "Categorias",
          value: String(summary.byCategory.length),
          hint: "com gasto no período",
        },
      ],
      facts: null,
      tables: [
        categoryTable(summary.byCategory, summary.paidCents),
        monthTable(summary.byMonth, period.year),
        {
          title: "Compras concluídas",
          columns: [
            { label: "Concluída", width: 1.1 },
            { label: "Compra", width: 3.4 },
            { label: "Categoria", width: 2 },
            { label: "Fornecedor", width: 2.2 },
            { label: "Cotações", width: 0.9, align: "right" },
            { label: "Valor", width: 1.3, align: "right" },
          ],
          rows: listed.items.map((item) => [
            formatLocalDate(item.completedOn),
            `${requestCode(item.number)} · ${item.title}`,
            item.categories
              .map((category) =>
                category === "OTHER" && item.categoryOther
                  ? item.categoryOther
                  : CATEGORY_LABELS[category],
              )
              .join(", "),
            item.supplierName,
            String(item.quoteCount),
            formatCents(item.totalCents),
          ]),
          note:
            listed.total > listed.items.length
              ? `Mostrando as ${listed.items.length} mais recentes de ${listed.total}.`
              : undefined,
        },
      ],
    };
    return {
      fileName: `prestacao-de-contas-compras-${periodSlug(period)}.pdf`,
      content: await this.renderer.render(input),
    };
  }

  private async header(actor: AuthenticatedUser, period: IndicatorPeriod) {
    const condominium = actor.condominiumId
      ? await this.condominiums.find(actor.condominiumId)
      : null;
    return {
      condominiumName: condominium?.name ?? "Condomínio",
      period: periodLabel(period),
      generatedAt: formatDateTime(this.clock.now(), this.clock.timeZone),
    };
  }
}

function days(value: number | null): string {
  if (value === null) return "—";
  if (value === 0) return "No mesmo dia";
  if (value < 1) return "Menos de 1 dia";
  const text = value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${text} ${value === 1 ? "dia" : "dias"} em média`;
}
