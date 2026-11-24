import { writeFileSync } from "node:fs";
import { PurchaseSummaryPdfUseCase } from "@/modules/purchases/application/use-cases/purchase-summary-pdf.use-case";
import { PdfLibPurchaseSummaryRenderer } from "@/modules/purchases/infrastructure/pdf/pdf-lib-purchase-summary.renderer";
import type { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { PurchaseApprovalRepositoryPort } from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import type { PurchaseQuoteRepositoryPort } from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import type { PurchaseRequestRepositoryPort } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import type { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import { DecidePurchaseApprovalUseCase } from "@/modules/purchases/application/use-cases/decide-purchase-approval.use-case";
import { PurchaseSettingsUseCase } from "@/modules/purchases/application/use-cases/purchase-settings.use-case";
import {
  ApprovalDecision,
  ApprovalMode,
  approvedOnChoosing,
  DEFAULT_PURCHASE_SETTINGS,
  type PurchaseApproval,
} from "@/modules/purchases/domain/purchase-approval";
import type { PurchaseQuote } from "@/modules/purchases/domain/purchase-quote";
import {
  PurchasePriority,
  type PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import type { ClockPort } from "@/shared/application/ports/clock.port";

const actor = { id: "sindico", name: "Carlos" } as AuthenticatedUser;

const request = (
  overrides: Partial<PurchaseRequest> = {},
): PurchaseRequest => ({
  id: "r1",
  condominiumId: "c1",
  number: 3,
  title: "Lâmpadas do hall",
  description: null,
  categories: [],
  categoryOther: null,
  priority: PurchasePriority.NORMAL,
  spaceId: null,
  location: null,
  neededBy: null,
  status: PurchaseRequestStatus.AWAITING_APPROVAL,
  requestedById: "gate",
  requestedByName: "Portaria",
  items: [
    {
      id: "i1",
      productId: "p1",
      productName: "Lâmpada",
      quantity: 10,
      unit: "un",
      brandId: null,
      brandName: null,
      note: null,
    },
  ],
  quoteCount: 3,
  chosenQuoteId: "q1",
  choiceJustification: null,
  chosenAt: new Date(),
  chosenById: "ana",
  chosenByName: "Ana",
  cancelReason: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const chosenQuote = {
  id: "q1",
  requestId: "r1",
  supplierId: "s1",
  supplierName: "Luz Forte",
  items: [{ requestItemId: "i1", unitPriceCents: 1500 }],
  shippingCents: 500,
  charges: [],
  chargesCents: 0,
  discountCents: 0,
  discountPercentBp: null,
  interestRateBp: null,
  deliveryDays: 2,
  paymentMethod: null,
  installments: null,
  paymentTerms: null,
  validUntil: null,
  notes: null,
  fileKey: null,
  fileIsPdf: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as PurchaseQuote;

describe("approvedOnChoosing", () => {
  it("approves up to the limit only in LIMIT mode", () => {
    const limit = {
      approvalMode: ApprovalMode.LIMIT,
      approvalLimitCents: 50_000,
    };
    expect(approvedOnChoosing(limit, 50_000)).toBe(true);
    expect(approvedOnChoosing(limit, 50_001)).toBe(false);
    expect(approvedOnChoosing(DEFAULT_PURCHASE_SETTINGS, 1)).toBe(false);
  });
});

describe("DecidePurchaseApprovalUseCase", () => {
  const setup = (current = request()) => {
    const approvals = {
      settings: jest.fn().mockResolvedValue({
        ...DEFAULT_PURCHASE_SETTINGS,
        approvalMode: ApprovalMode.LIMIT,
        approvalLimitCents: 10_000,
      }),
      decide: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<PurchaseApprovalRepositoryPort>;
    const useCase = new DecidePurchaseApprovalUseCase(
      {
        find: jest.fn().mockResolvedValue(current),
      } as unknown as PurchaseRequestRepositoryPort,
      {
        find: jest.fn().mockResolvedValue(chosenQuote),
      } as unknown as PurchaseQuoteRepositoryPort,
      approvals,
      {
        condominiumOf: jest.fn().mockResolvedValue("c1"),
        managers: jest.fn().mockResolvedValue(["ana", "sindico"]),
      } as unknown as PurchasesAccessService,
      { stamp: jest.fn() } as unknown as AuditTrailService,
      { kick: jest.fn() } as unknown as OutboxDispatcher,
      { now: () => new Date("2026-11-23T12:00:00Z") } as ClockPort,
    );
    return { approvals, useCase };
  };

  it("approves with the totals and the limit as they were, telling the others", async () => {
    const { approvals, useCase } = setup();
    await useCase.approve(actor, "r1", "  Pode   comprar. ");
    const [requestId, outcome, approval, notices] =
      approvals.decide.mock.calls[0];
    expect(requestId).toBe("r1");
    expect(outcome).toBe(PurchaseRequestStatus.APPROVED);
    expect(approval).toMatchObject({
      decision: ApprovalDecision.APPROVED,
      supplierName: "Luz Forte",
      totalCents: 15_500,
      limitCents: 10_000,
      note: "Pode comprar.",
      chosenById: "ana",
      decidedById: "sindico",
    });
    // Whoever asked and the other manager; not whoever decided.
    expect(notices.map((notice) => notice.payload.userId).sort()).toEqual([
      "ana",
      "gate",
    ]);
    expect(notices[0].payload.type).toBe(NotificationType.PURCHASE_APPROVED);
  });

  it("returns to quotes or rejects only with a reason", async () => {
    const { approvals, useCase } = setup();
    await expect(useCase.returnToQuotes(actor, "r1", " ")).rejects.toThrow();
    await expect(useCase.reject(actor, "r1", "ok")).rejects.toThrow();
    await useCase.returnToQuotes(actor, "r1", "Falta uma cotação");
    await useCase.reject(actor, "r1", "Sem verba este mês");
    expect(approvals.decide.mock.calls.map((call) => call[1])).toEqual([
      PurchaseRequestStatus.QUOTING,
      PurchaseRequestStatus.REJECTED,
    ]);
  });

  it("refuses a request that no longer waits", async () => {
    const { approvals, useCase } = setup(
      request({ status: PurchaseRequestStatus.APPROVED }),
    );
    await expect(useCase.approve(actor, "r1", null)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "PURCHASE_NOT_AWAITING_APPROVAL",
      }),
    });
    expect(approvals.decide).not.toHaveBeenCalled();
  });

  it("lets whoever chose it approve it too (both are recorded)", async () => {
    const { approvals, useCase } = setup();
    await useCase.approve(
      { id: "ana", name: "Ana" } as AuthenticatedUser,
      "r1",
      null,
    );
    expect(approvals.decide.mock.calls[0][2]).toMatchObject({
      chosenById: "ana",
      decidedById: "ana",
    });
  });
});

describe("PurchaseSettingsUseCase", () => {
  const setup = () => {
    const approvals = {
      saveSettings: jest.fn().mockResolvedValue(DEFAULT_PURCHASE_SETTINGS),
    } as unknown as jest.Mocked<PurchaseApprovalRepositoryPort>;
    const useCase = new PurchaseSettingsUseCase(approvals, {
      condominiumOf: jest.fn().mockResolvedValue("c1"),
    } as unknown as PurchasesAccessService);
    return { approvals, useCase };
  };

  it("needs the limit with LIMIT and drops it with ALWAYS", async () => {
    const { approvals, useCase } = setup();
    await expect(
      useCase.save(actor, ApprovalMode.LIMIT, null),
    ).rejects.toThrow();
    await expect(useCase.save(actor, ApprovalMode.LIMIT, 0)).rejects.toThrow();
    await useCase.save(actor, ApprovalMode.LIMIT, 50_000);
    await useCase.save(actor, ApprovalMode.ALWAYS, 50_000);
    expect(approvals.saveSettings.mock.calls).toEqual([
      ["c1", ApprovalMode.LIMIT, 50_000, "sindico"],
      ["c1", ApprovalMode.ALWAYS, null, "sindico"],
    ]);
  });
});

describe("PurchaseSummaryPdfUseCase", () => {
  const clock = {
    now: () => new Date("2026-11-23T15:00:00Z"),
    timeZone: "America/Sao_Paulo",
  } as ClockPort;
  const useCase = new PurchaseSummaryPdfUseCase(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    new PdfLibPurchaseSummaryRenderer(),
    clock,
  );
  const view = (overrides: object = {}) =>
    ({
      ...chosenQuote,
      totalCents: 15_500,
      cashCents: 15_500,
      complete: true,
      cheapest: true,
      chosen: true,
      createdAt: new Date("2026-11-21T10:00:00Z"),
      ...overrides,
    }) as never;
  const approval = (
    overrides: Pick<PurchaseApproval, "decision"> & Partial<PurchaseApproval>,
  ): PurchaseApproval => ({
    id: "a",
    requestId: "r1",
    quoteId: "q1",
    supplierName: "Luz Forte",
    totalCents: 15_500,
    limitCents: 10_000,
    note: null,
    chosenById: "ana",
    chosenByName: "Ana",
    decidedById: "sindico",
    decidedByName: "Carlos",
    decidedAt: new Date("2026-11-22T12:00:00Z"),
    ...overrides,
  });

  it("says how it was decided and keeps the timeline in order", async () => {
    const input = useCase.input(
      request({
        status: PurchaseRequestStatus.APPROVED,
        createdAt: new Date("2026-11-20T09:00:00Z"),
        choiceJustification: "Entrega em 2 dias",
      }),
      [
        view(),
        view({
          id: "q2",
          supplierName: "Casa & Cia",
          totalCents: 16_000,
          cheapest: false,
          chosen: false,
        }),
      ],
      [
        approval({ decision: ApprovalDecision.APPROVED, note: "Pode comprar" }),
        approval({
          decision: ApprovalDecision.RETURNED,
          note: "Negociar o frete",
          decidedAt: new Date("2026-11-21T18:00:00Z"),
        }),
      ],
      { code: "SC-0003", condominiumName: "Residencial Jardim" },
    );
    expect(input.status).toMatchObject({ tone: "good" });
    expect(input.status.line).toContain("Aprovada por Carlos");
    expect(input.quotes[0].line).toContain("escolhida");
    // Intl puts a no-break space after "R$".
    expect(
      input.timeline.map((entry) =>
        entry.event.replaceAll(String.fromCharCode(160), " "),
      ),
    ).toEqual([
      "Solicitação feita por Portaria.",
      "Cotação de Luz Forte (R$ 155,00) registrada.",
      "Cotação de Casa & Cia (R$ 160,00) registrada.",
      expect.stringContaining("devolvida para cotação por Carlos"),
      expect.stringContaining("aprovada por Carlos"),
    ]);
    expect(input.signers).toEqual([
      { name: "Ana", role: "Escolhida por" },
      { name: "Carlos", role: "Aprovada por" },
    ]);
    const pdf = await new PdfLibPurchaseSummaryRenderer().render(input);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    if (process.env.SAMPLE_OUT) {
      writeFileSync(process.env.SAMPLE_OUT, pdf);
    }
  });

  it("leaves the approver line blank within the limit, and red when rejected", () => {
    const auto = useCase.input(
      request({ status: PurchaseRequestStatus.APPROVED }),
      [view()],
      [
        approval({
          decision: ApprovalDecision.AUTO_APPROVED,
          totalCents: 9000,
        }),
      ],
      { code: "SC-0002", condominiumName: "Residencial" },
    );
    expect(auto.status.line).toContain("Aprovada na alçada");
    expect(auto.signers[1]).toEqual({ name: "", role: "Aprovada por" });

    const rejected = useCase.input(
      request({ status: PurchaseRequestStatus.REJECTED }),
      [view()],
      [approval({ decision: ApprovalDecision.REJECTED, note: "Sem verba" })],
      { code: "SC-0004", condominiumName: "Residencial" },
    );
    expect(rejected.status).toMatchObject({ tone: "bad" });
    expect(rejected.status.line).toContain("Motivo: Sem verba");
    expect(rejected.signers[1].role).toBe("Reprovada por");
  });
});
