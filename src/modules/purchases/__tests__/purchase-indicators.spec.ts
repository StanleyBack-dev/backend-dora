import { writeFileSync } from "node:fs";
import type { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { Category } from "@/modules/catalog/domain/category";
import type { PurchaseIndicatorsRepositoryPort } from "@/modules/purchases/application/ports/purchase-indicators-repository.port";
import type { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import { PurchaseIndicatorsUseCase } from "@/modules/purchases/application/use-cases/purchase-indicators.use-case";
import { PurchaseReportPdfUseCase } from "@/modules/purchases/application/use-cases/purchase-report-pdf.use-case";
import { PurchaseTransparencyUseCase } from "@/modules/purchases/application/use-cases/purchase-transparency.use-case";
import {
  type PaidRow,
  periodRange,
  processIndicators,
  spendBreakdown,
  spendByMonth,
  validPeriod,
} from "@/modules/purchases/domain/purchase-indicators";
import { PdfLibPurchaseReportRenderer } from "@/modules/purchases/infrastructure/pdf/pdf-lib-purchase-report.renderer";
import type { SupplierRepositoryPort } from "@/modules/suppliers/application/ports/supplier-repository.port";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import type { ClockPort } from "@/shared/application/ports/clock.port";

const resident = {
  id: "rui",
  name: "Rui",
  condominiumId: "c1",
} as AuthenticatedUser;

const clock = {
  now: () => new Date("2026-11-23T15:00:00Z"),
  timeZone: "America/Sao_Paulo",
} as ClockPort;

const row = (over: Partial<PaidRow>): PaidRow => ({
  requestId: "r1",
  categories: [Category.ELECTRICAL],
  supplierId: "s1",
  supplierName: "Luz Forte",
  month: 11,
  paidCents: 12900,
  installments: 1,
  ...over,
});

const ROWS: PaidRow[] = [
  row({}),
  row({
    requestId: "r2",
    categories: [Category.CLEANING, Category.OFFICE],
    supplierId: "s2",
    supplierName: "Casa & Cia",
    paidCents: 1001,
  }),
  row({ requestId: "r3", month: 3, paidCents: 5000 }),
];

describe("purchase indicators (domain)", () => {
  it("gives the period's days, the year or a month", () => {
    expect(periodRange({ year: 2026, month: null })).toEqual({
      from: "2026-01-01",
      to: "2027-01-01",
    });
    expect(periodRange({ year: 2026, month: 12 })).toEqual({
      from: "2026-12-01",
      to: "2027-01-01",
    });
    expect(validPeriod({ year: 2026, month: 13 })).toBe(false);
    expect(validPeriod({ year: 1999, month: null })).toBe(false);
  });

  it("splits a purchase in several categories so they add up", () => {
    const spend = spendBreakdown(ROWS);
    expect(spend.paidCents).toBe(18901);
    expect(spend.purchases).toBe(3);
    const cents = Object.fromEntries(
      spend.byCategory.map((item) => [item.category, item.cents]),
    );
    expect(cents).toEqual({ ELECTRICAL: 17900, CLEANING: 501, OFFICE: 500 });
    expect(spend.byCategory.reduce((sum, item) => sum + item.cents, 0)).toBe(
      spend.paidCents,
    );
    expect(spend.bySupplier[0]).toMatchObject({
      supplierName: "Luz Forte",
      cents: 17900,
      purchases: 2,
    });
  });

  it("fills the twelve months", () => {
    const months = spendByMonth(ROWS);
    expect(months).toHaveLength(12);
    expect(months[10].cents).toBe(13901);
    expect(months[2].cents).toBe(5000);
    expect(months[0].cents).toBe(0);
  });

  it("sums the savings only where both quotes were complete", () => {
    expect(
      processIndicators([
        {
          quoteCount: 3,
          chosenCashCents: 12900,
          highestCashCents: 15000,
          daysToOrder: 2,
          daysToDeliver: 1,
          late: false,
        },
        {
          quoteCount: 1,
          chosenCashCents: null,
          highestCashCents: 9000,
          daysToOrder: 4,
          daysToDeliver: null,
          late: true,
        },
      ]),
    ).toEqual({
      orders: 2,
      savingsCents: 2100,
      withThreeQuotes: 1,
      avgDaysToOrder: 3,
      avgDaysToDeliver: 1,
      lateDeliveries: 1,
    });
  });
});

const figures = (enabled: boolean) =>
  ({
    paid: jest.fn().mockResolvedValue(ROWS),
    committed: jest
      .fn()
      .mockResolvedValue({ cents: 9624, installments: 2, orders: 1 }),
    process: jest.fn().mockResolvedValue([]),
    completed: jest.fn().mockResolvedValue({
      items: [
        {
          number: 5,
          title: "Lâmpadas do hall",
          categories: [Category.ELECTRICAL],
          categoryOther: null,
          supplierName: "Luz Forte",
          totalCents: 12900,
          completedOn: "2026-11-23",
          quoteCount: 3,
        },
      ],
      total: 1,
      page: 1,
      limit: 500,
      totalPages: 1,
    }),
    transparency: jest
      .fn()
      .mockResolvedValue({ enabled, updatedAt: null, updatedByName: null }),
    setTransparency: jest.fn(),
  }) as unknown as jest.Mocked<PurchaseIndicatorsRepositoryPort>;

const access = (granted: string[]) =>
  ({
    condominiumOf: jest.fn().mockResolvedValue("c1"),
    condominiumWithAny: jest.fn((_actor: unknown, ...needed: string[]) =>
      needed.some((permission) => granted.includes(permission))
        ? Promise.resolve("c1")
        : Promise.reject(new Error("missing permission")),
    ),
    residents: jest.fn().mockResolvedValue(["rui", "lia"]),
    hasAny: jest.fn((_actor: unknown, ...needed: string[]) =>
      Promise.resolve(
        needed.some((permission) => granted.includes(permission)),
      ),
    ),
  }) as unknown as PurchasesAccessService;

describe("PurchaseTransparencyUseCase", () => {
  const period = { year: 2026, month: 11 };

  it("refuses the residents while it isn't published", async () => {
    const useCase = new PurchaseTransparencyUseCase(
      figures(false),
      access([]),
      clock,
      { kick: jest.fn() } as unknown as OutboxDispatcher,
    );
    await expect(useCase.summary(resident, period)).rejects.toThrow(
      "não está publicada",
    );
  });

  it("lets the management preview it, and the residents once published", async () => {
    const preview = new PurchaseTransparencyUseCase(
      figures(false),
      access(["PURCHASES_MANAGE"]),
      clock,
      { kick: jest.fn() } as unknown as OutboxDispatcher,
    );
    await expect(preview.summary(resident, period)).resolves.toMatchObject({
      paidCents: 13901,
      purchases: 2,
    });
    const published = new PurchaseTransparencyUseCase(
      figures(true),
      access([]),
      clock,
      { kick: jest.fn() } as unknown as OutboxDispatcher,
    );
    const summary = await published.summary(resident, period);
    expect(summary.byMonth).toHaveLength(12);
  });

  it("refuses a period out of range", async () => {
    const useCase = new PurchaseTransparencyUseCase(
      figures(true),
      access([]),
      clock,
      { kick: jest.fn() } as unknown as OutboxDispatcher,
    );
    await expect(
      useCase.summary(resident, { year: 2026, month: 0 }),
    ).rejects.toThrow();
  });

  it("is published only by the approvers", async () => {
    const repo = figures(false);
    await expect(
      new PurchaseTransparencyUseCase(repo, access([]), clock, {
        kick: jest.fn(),
      } as unknown as OutboxDispatcher).publish(resident, true),
    ).rejects.toThrow();
    await new PurchaseTransparencyUseCase(
      repo,
      access(["PURCHASES_APPROVE"]),
      clock,
      { kick: jest.fn() } as unknown as OutboxDispatcher,
    ).publish(resident, true);
    const [condominiumId, enabled, by, notices] =
      repo.setTransparency.mock.calls[0];
    expect([condominiumId, enabled, by]).toEqual(["c1", true, "rui"]);
    expect(notices).toHaveLength(2);
    expect(notices[0].payload).toMatchObject({
      type: NotificationType.PURCHASE_TRANSPARENCY_PUBLISHED,
      link: "/compras/prestacao-de-contas",
    });
  });
});

describe("PurchaseReportPdfUseCase", () => {
  it("renders the indicators and the accounts as landscape PDFs", async () => {
    const repo = figures(true);
    const suppliers = {
      activeOptions: jest
        .fn()
        .mockResolvedValue([{ id: "s1", ratingAverage: 4, ratingCount: 1 }]),
    } as unknown as SupplierRepositoryPort;
    const manager = access(["PURCHASES_MANAGE"]);
    const reports = new PurchaseReportPdfUseCase(
      new PurchaseIndicatorsUseCase(repo, suppliers, manager, clock),
      new PurchaseTransparencyUseCase(repo, manager, clock, {
        kick: jest.fn(),
      } as unknown as OutboxDispatcher),
      repo,
      new PdfLibPurchaseReportRenderer(),
      {
        find: jest.fn().mockResolvedValue({ name: "Residencial Aurora" }),
      } as unknown as CondominiumLookupService,
      clock,
    );
    const indicators = await reports.indicators(resident, {
      year: 2026,
      month: null,
    });
    expect(indicators.fileName).toBe("indicadores-de-compras-2026.pdf");
    expect(indicators.content.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const accounts = await reports.transparency(resident, {
      year: 2026,
      month: 11,
    });
    expect(accounts.fileName).toBe("prestacao-de-contas-compras-2026-11.pdf");
    if (process.env.SAMPLE_OUT) {
      writeFileSync(
        `${process.env.SAMPLE_OUT}-indicadores.pdf`,
        indicators.content,
      );
      writeFileSync(`${process.env.SAMPLE_OUT}-contas.pdf`, accounts.content);
    }
  });
});
