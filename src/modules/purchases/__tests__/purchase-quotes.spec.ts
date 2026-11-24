import type { PurchaseApprovalRepositoryPort } from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import {
  ApprovalDecision,
  ApprovalMode,
  DEFAULT_PURCHASE_SETTINGS,
  type PurchaseSettings,
} from "@/modules/purchases/domain/purchase-approval";
import type { SendDocumentEmailUseCase } from "@/modules/mails/application/use-cases/send-document-email.use-case";
import { PurchaseDocumentMailer } from "@/modules/purchases/application/purchase-document-mailer";
import { ShareQuoteMapUseCase } from "@/modules/purchases/application/use-cases/share-quote-map.use-case";
import type { RateLimitPort } from "@/shared/application/ports/rate-limit.port";
import type { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import type { PurchaseQuoteRepositoryPort } from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import type { PurchaseRequestRepositoryPort } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  normalizeJustification,
  validateQuoteInput,
} from "@/modules/purchases/application/purchase-quote-input";
import type { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  type ListPurchaseQuotesUseCase,
  paymentLine,
} from "@/modules/purchases/application/use-cases/list-purchase-quotes.use-case";
import { ChoosePurchaseQuoteUseCase } from "@/modules/purchases/application/use-cases/choose-purchase-quote.use-case";
import { ListQuoteBoardUseCase } from "@/modules/purchases/application/use-cases/list-quote-board.use-case";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import {
  cheapestQuoteIds,
  choiceNeedsJustification,
  installmentCents,
  installmentPlan,
  PaymentMethod,
  type PurchaseQuote,
  quoteTotals,
} from "@/modules/purchases/domain/purchase-quote";
import { PdfLibQuoteMapRenderer } from "@/modules/purchases/infrastructure/pdf/pdf-lib-quote-map.renderer";
import type { ClockPort } from "@/shared/application/ports/clock.port";

const ITEMS = [
  { id: "i1", quantity: 12 },
  { id: "i2", quantity: 2.5 },
];

const quantities = new Map([
  ["i1", 12],
  ["i2", 2.5],
]);

const quote = (
  id: string,
  prices: [number | null, number | null],
  shippingCents = 0,
): PurchaseQuote => ({
  id,
  requestId: "r1",
  supplierId: `s-${id}`,
  supplierName: `Fornecedor ${id}`,
  items: [
    { requestItemId: "i1", unitPriceCents: prices[0] },
    { requestItemId: "i2", unitPriceCents: prices[1] },
  ],
  shippingCents,
  charges: [],
  chargesCents: 0,
  discountCents: 0,
  discountPercentBp: null,
  interestRateBp: null,
  deliveryDays: null,
  paymentMethod: null,
  installments: null,
  paymentTerms: null,
  validUntil: null,
  notes: null,
  fileKey: null,
  fileIsPdf: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const withTotals = (quotes: PurchaseQuote[]) =>
  quotes.map((each) => ({ id: each.id, ...quoteTotals(each, quantities) }));

describe("quote totals", () => {
  it("sums quantity × price plus shipping, rounding to the cent", () => {
    expect(
      quoteTotals(quote("a", [1000, 333], 1500), quantities),
    ).toMatchObject({
      itemsCents: 12_000 + 833,
      totalCents: 12_000 + 833 + 1500,
      complete: true,
    });
  });

  it("marks a quote missing an item as partial", () => {
    expect(quoteTotals(quote("a", [1000, null]), quantities).complete).toBe(
      false,
    );
  });

  it("finds the cheapest complete quote, ignoring partial ones", () => {
    const quotes = withTotals([
      quote("a", [1000, 1000]),
      quote("b", [900, 1000]),
      quote("c", [100, null]),
    ]);
    expect(cheapestQuoteIds(quotes)).toEqual(["b"]);
  });

  it("asks a justification below 3 quotes or when not the cheapest", () => {
    const two = withTotals([quote("a", [900, 900]), quote("b", [1000, 900])]);
    expect(choiceNeedsJustification("a", two)).toBe(true);
    const three = withTotals([
      quote("a", [900, 900]),
      quote("b", [1000, 900]),
      quote("c", [1100, 900]),
    ]);
    expect(choiceNeedsJustification("a", three)).toBe(false);
    expect(choiceNeedsJustification("b", three)).toBe(true);
  });
});

describe("validateQuoteInput", () => {
  it("orders the prices by the request items, missing ones as null", () => {
    expect(
      validateQuoteInput(
        {
          items: [{ requestItemId: "i2", unitPriceCents: 500 }],
          shippingCents: null,
          paymentMethod: PaymentMethod.OTHER,
          paymentTerms: "  30   dias ",
        },
        ITEMS,
      ),
    ).toMatchObject({
      items: [
        { requestItemId: "i1", unitPriceCents: null },
        { requestItemId: "i2", unitPriceCents: 500 },
      ],
      shippingCents: 0,
      deliveryDays: null,
      paymentMethod: PaymentMethod.OTHER,
      installments: null,
      paymentTerms: "30 dias",
      validUntil: null,
      notes: null,
    });
  });

  it.each([
    ["an item of another request", [{ requestItemId: "x", unitPriceCents: 1 }]],
    ["no price at all", [{ requestItemId: "i1", unitPriceCents: null }]],
    ["a negative price", [{ requestItemId: "i1", unitPriceCents: -1 }]],
    ["a fraction of a cent", [{ requestItemId: "i1", unitPriceCents: 1.5 }]],
  ])("refuses %s", (_label, items) => {
    expect(() => validateQuoteInput({ items }, ITEMS)).toThrow();
  });

  it("asks a justification of 3 to 300 characters when given", () => {
    expect(normalizeJustification("  ")).toBeNull();
    expect(() => normalizeJustification("ok")).toThrow();
    expect(normalizeJustification(" Entrega   mais rápida ")).toBe(
      "Entrega mais rápida",
    );
  });
});

describe("ChoosePurchaseQuoteUseCase", () => {
  const actor = { id: "m1", name: "Ana" } as AuthenticatedUser;
  const request = {
    id: "r1",
    condominiumId: "c1",
    number: 1,
    title: "Lâmpadas",
    requestedById: "gate",
    items: [
      { id: "i1", quantity: 12 },
      { id: "i2", quantity: 2.5 },
    ],
  };
  const setup = (
    settings: Pick<
      PurchaseSettings,
      "approvalMode" | "approvalLimitCents"
    > = DEFAULT_PURCHASE_SETTINGS,
  ) => {
    const quotes = {
      find: jest.fn().mockResolvedValue(quote("b", [1000, 900])),
      listFor: jest
        .fn()
        .mockResolvedValue([quote("a", [900, 900]), quote("b", [1000, 900])]),
      choose: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<PurchaseQuoteRepositoryPort>;
    const requests = {
      find: jest.fn().mockResolvedValue(request),
    } as unknown as PurchaseRequestRepositoryPort;
    const useCase = new ChoosePurchaseQuoteUseCase(
      quotes,
      requests,
      {
        condominiumOf: jest.fn().mockResolvedValue("c1"),
        managers: jest.fn().mockResolvedValue(["m1", "m2"]),
        approvers: jest.fn().mockResolvedValue(["m1", "m2"]),
      } as unknown as PurchasesAccessService,
      { stamp: jest.fn() } as unknown as AuditTrailService,
      { kick: jest.fn() } as unknown as OutboxDispatcher,
      { now: () => new Date() } as ClockPort,
      {
        settings: jest.fn().mockResolvedValue(settings),
      } as unknown as PurchaseApprovalRepositoryPort,
    );
    return { quotes, useCase };
  };

  it("refuses a pricier choice without a justification", async () => {
    const { quotes, useCase } = setup();
    await expect(useCase.choose(actor, "b", null)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "PURCHASE_QUOTE_JUSTIFICATION_REQUIRED",
      }),
    });
    expect(quotes.choose).not.toHaveBeenCalled();
  });

  it("chooses it with the justification", async () => {
    const { quotes, useCase } = setup();
    await useCase.choose(actor, "b", "Entrega em 2 dias");
    expect(quotes.choose).toHaveBeenCalledWith(
      "r1",
      "b",
      "Entrega em 2 dias",
      "m1",
      expect.any(Date),
      expect.objectContaining({ autoApproval: null }),
    );
    // Waits: the other approver is told (not whoever chose).
    const outcome = quotes.choose.mock.calls[0][5];
    expect(outcome.notices.map((notice) => notice.payload.userId)).toEqual([
      "m2",
    ]);
  });

  it("approves on choosing within the limit, waits above it", async () => {
    // b totals 12 × 10,00 + 2,5 × 9,00 = R$ 142,50.
    const within = setup({
      approvalMode: ApprovalMode.LIMIT,
      approvalLimitCents: 14_250,
    });
    await within.useCase.choose(actor, "b", "Entrega em 2 dias");
    expect(within.quotes.choose.mock.calls[0][5].autoApproval).toMatchObject({
      decision: ApprovalDecision.AUTO_APPROVED,
      totalCents: 14_250,
      limitCents: 14_250,
      decidedById: "m1",
    });

    const above = setup({
      approvalMode: ApprovalMode.LIMIT,
      approvalLimitCents: 14_249,
    });
    await above.useCase.choose(actor, "b", "Entrega em 2 dias");
    expect(above.quotes.choose.mock.calls[0][5].autoApproval).toBeNull();
  });
});

describe("PdfLibQuoteMapRenderer", () => {
  const quote = (supplierName: string, overrides: object = {}) => ({
    supplierName,
    lines: [{ unitCents: 1290, lineCents: 15_480 }],
    itemsCents: 15_480,
    shippingCents: 1500,
    charges: [{ label: "Instalação", amountCents: 2000 }],
    discountCents: 500,
    discountPercentBp: 300,
    interestRateBp: null,
    cashCents: 18_480,
    interestCents: 0,
    totalCents: 18_480,
    complete: true,
    cheapest: false,
    chosen: false,
    deliveryDays: 2,
    payment: "Cartão de crédito · 3x de R$ 56,60",
    validUntil: "30/11/2026",
    notes: "Entrega no condomínio - sem custo extra.",
    file: "PDF",
    ...overrides,
  });
  const input = {
    code: "SC-0007",
    title: "Lâmpadas do hall",
    condominiumName: "Residencial Jardim",
    requestedByName: "Ana Síndica",
    neededBy: "05/12/2026",
    location: "Hall de entrada",
    generatedAt: "22/11/2026 10:00",
    items: [{ label: "Lâmpada LED 9W · Philips", quantity: "12 un" }],
    justification: "Entrega mais rápida.",
    chosenByName: "Ana",
    decision: {
      kind: ApprovalDecision.APPROVED,
      byName: "Carlos Síndico",
      at: "22/11/2026 15:00",
      note: "Pode comprar.",
      limitCents: 10_000,
    },
  };

  it("writes a PDF", async () => {
    const pdf = await new PdfLibQuoteMapRenderer().render({
      ...input,
      quotes: [quote("Elétrica Central", { cheapest: true, chosen: true })],
    });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("splits many suppliers and items over column blocks and pages", async () => {
    const pdf = await new PdfLibQuoteMapRenderer().render({
      ...input,
      items: Array.from({ length: 30 }, (_, index) => ({
        label: `Item ${index + 1} com um nome bem comprido para quebrar a linha da tabela`,
        quantity: "2 un",
      })),
      quotes: Array.from({ length: 7 }, (_, index) =>
        quote(`Fornecedor ${index + 1}`, {
          lines: Array.from({ length: 30 }, (_, at) =>
            at === index
              ? { unitCents: null, lineCents: null }
              : { unitCents: 100, lineCents: 200 },
          ),
          complete: false,
        }),
      ),
      justification: null,
    });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});

describe("payment", () => {
  const terms = (overrides: object) =>
    validateQuoteInput(
      { items: [{ requestItemId: "i1", unitPriceCents: 100 }], ...overrides },
      [{ id: "i1", quantity: 1 }],
    );

  it("splits the total, the last installment taking the cents left", () => {
    expect(installmentCents(10_000, 3)).toEqual([3333, 3333, 3334]);
  });

  it("accepts installments only for the methods that allow them", () => {
    expect(
      terms({ paymentMethod: PaymentMethod.CREDIT_CARD, installments: 3 })
        .installments,
    ).toBe(3);
    expect(
      terms({ paymentMethod: PaymentMethod.PIX, installments: 1 }).installments,
    ).toBeNull();
    expect(() =>
      terms({ paymentMethod: PaymentMethod.PIX, installments: 3 }),
    ).toThrow();
    expect(() =>
      terms({ paymentMethod: PaymentMethod.BOLETO, installments: 61 }),
    ).toThrow();
  });

  it("asks the text with OTHER and drops it otherwise", () => {
    expect(() => terms({ paymentMethod: PaymentMethod.OTHER })).toThrow();
    expect(
      terms({ paymentMethod: PaymentMethod.PIX, paymentTerms: "x" })
        .paymentTerms,
    ).toBeNull();
  });

  it("writes how it is paid as a line", () => {
    // Intl puts a no-break space after "R$".
    const line = (quote: Parameters<typeof paymentLine>[0]) =>
      paymentLine(quote)?.replaceAll(String.fromCharCode(160), " ");
    expect(
      line({
        paymentMethod: PaymentMethod.CREDIT_CARD,
        installments: 3,
        paymentTerms: null,
        cashCents: 10_000,
        interestRateBp: null,
      }),
    ).toBe("Cartão de crédito · 3x de R$ 33,33 (última de R$ 33,34) sem juros");
    expect(
      line({
        paymentMethod: PaymentMethod.PIX,
        installments: null,
        paymentTerms: null,
        cashCents: 10_000,
        interestRateBp: null,
      }),
    ).toBe("PIX · à vista");
  });
});

describe("charges, discount and interest", () => {
  const base = { ...quote("a", [1000, 1000], 500) };

  it("adds the charges and takes off the discount (paid at once)", () => {
    expect(
      quoteTotals(
        { ...base, chargesCents: 2000, discountCents: 1500 },
        quantities,
      ),
    ).toMatchObject({
      itemsCents: 14_500,
      cashCents: 14_500 + 500 + 2000 - 1500,
      totalCents: 14_500 + 500 + 2000 - 1500,
      interestCents: 0,
    });
  });

  it("charges the Price table interest on the installments", () => {
    // R$ 1.000,00 in 3x at 2% a month: 3 × R$ 346,75.
    expect(installmentPlan(100_000, 3, 200)).toEqual([34_675, 34_675, 34_675]);
    const totals = quoteTotals(
      { ...base, installments: 3, interestRateBp: 200 },
      quantities,
    );
    expect(totals.totalCents).toBe(
      3 * installmentPlan(totals.cashCents, 3, 200)[0],
    );
    expect(totals.interestCents).toBeGreaterThan(0);
  });

  it("compares the final value paid", () => {
    const cheapCash = quote("a", [900, 900]);
    const financed = { ...cheapCash, installments: 12, interestRateBp: 500 };
    const other = quote("b", [950, 950]);
    expect(
      cheapestQuoteIds([
        { id: "a", ...quoteTotals(financed, quantities) },
        { id: "b", ...quoteTotals(other, quantities) },
      ]),
    ).toEqual(["b"]);
  });

  it("refuses a discount above the quote and interest paid at once", () => {
    const items = [{ requestItemId: "i1", unitPriceCents: 1000 }];
    expect(() =>
      validateQuoteInput({ items, discountCents: 20_000 }, ITEMS),
    ).toThrow();
    expect(() =>
      validateQuoteInput(
        { items, paymentMethod: PaymentMethod.PIX, interestRateBp: 199 },
        ITEMS,
      ),
    ).toThrow();
    expect(
      validateQuoteInput(
        {
          items,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          installments: 3,
          interestRateBp: 199,
          charges: [{ label: " Instalação ", amountCents: 500 }],
        },
        ITEMS,
      ),
    ).toMatchObject({
      interestRateBp: 199,
      charges: [{ label: "Instalação", amountCents: 500 }],
      chargesCents: 500,
    });
  });

  it("sums several charges and works a percent discount out", () => {
    const items = [{ requestItemId: "i1", unitPriceCents: 1000 }];
    // 12 × R$ 10 + R$ 5 + R$ 5 = R$ 130; 10% = R$ 13.
    expect(
      validateQuoteInput(
        {
          items,
          charges: [
            { label: "Instalação", amountCents: 500 },
            { label: "Taxa", amountCents: 500 },
          ],
          discountCents: 99_999,
          discountPercentBp: 1000,
        },
        ITEMS,
      ),
    ).toMatchObject({
      chargesCents: 1000,
      discountCents: 1300,
      discountPercentBp: 1000,
    });
    expect(() =>
      validateQuoteInput(
        { items, charges: [{ label: "Taxa", amountCents: 0 }] },
        ITEMS,
      ),
    ).toThrow();
    expect(() =>
      validateQuoteInput(
        { items, charges: [{ label: " ", amountCents: 100 }] },
        ITEMS,
      ),
    ).toThrow();
    expect(() =>
      validateQuoteInput({ items, discountPercentBp: 10_001 }, ITEMS),
    ).toThrow();
  });
});

describe("ListQuoteBoardUseCase", () => {
  const actor = { id: "m1" } as AuthenticatedUser;
  const setup = () => {
    const request = {
      id: "r1",
      chosenQuoteId: "b",
      items: [
        { id: "i1", quantity: 12 },
        { id: "i2", quantity: 2.5 },
      ],
    };
    const requests = {
      list: jest.fn().mockResolvedValue({
        items: [request],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    } as unknown as jest.Mocked<PurchaseRequestRepositoryPort>;
    const quotes = {
      listFor: jest
        .fn()
        .mockResolvedValue([
          quote("a", [900, 900]),
          quote("b", [1000, 900]),
          quote("c", [800, null]),
        ]),
    } as unknown as PurchaseQuoteRepositoryPort;
    const access = {
      condominiumOf: jest.fn().mockResolvedValue("c1"),
    } as unknown as PurchasesAccessService;
    return {
      requests,
      useCase: new ListQuoteBoardUseCase(requests, quotes, access),
    };
  };

  it("shows how each request quotes stand", async () => {
    const { useCase, requests } = setup();
    const page = await useCase.list(actor, {}, { page: 1, limit: 20 });
    expect(requests.list.mock.calls[0][1].statuses).toEqual([
      "OPEN",
      "QUOTING",
      "AWAITING_APPROVAL",
      "APPROVED",
      "ORDERED",
      "RECEIVED",
      "COMPLETED",
      "REJECTED",
    ]);
    expect(page.items[0]).toMatchObject({
      quoteCount: 3,
      completeCount: 2,
      cheapest: { supplierName: "Fornecedor a", totalCents: 12 * 900 + 2250 },
      chosen: { supplierName: "Fornecedor b" },
    });
  });

  it("lists nothing for statuses outside the quote stages", async () => {
    const { useCase, requests } = setup();
    const page = await useCase.list(
      actor,
      { statuses: [PurchaseRequestStatus.CANCELLED] },
      { page: 1, limit: 20 },
    );
    expect(page.items).toEqual([]);
    expect(requests.list).not.toHaveBeenCalled();
  });
});

describe("ShareQuoteMapUseCase", () => {
  const actor = {
    id: "m1",
    name: "Ana",
    email: "ana@condominio.test",
  } as AuthenticatedUser;
  const file = {
    fileName: "mapa-de-cotacao-SC-0001.pdf",
    content: Buffer.from("%PDF-"),
    code: "SC-0001",
    title: "Papel Toalha",
    condominiumName: "Residencial Jardim",
    quoteCount: 3,
    cheapest: "Limpeza Total · R$ 114,70",
    chosen: null,
  };
  const setup = (count = 1) => {
    const listing = {
      mapPdf: jest.fn().mockResolvedValue(file),
    } as unknown as ListPurchaseQuotesUseCase;
    const documents = {
      send: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SendDocumentEmailUseCase>;
    const limits = {
      hit: jest.fn().mockResolvedValue({ count, resetAt: new Date() }),
    } as unknown as RateLimitPort;
    return {
      documents,
      share: new ShareQuoteMapUseCase(
        listing,
        new PurchaseDocumentMailer(documents, limits),
      ),
    };
  };

  it("sends the PDF attached, once per distinct address", async () => {
    const { documents, share } = setup();
    await expect(
      share.byEmail(
        actor,
        "r1",
        ["Sindico@x.com", "sindico@x.com ", "conselho@x.com"],
        "  Segue o mapa. ",
      ),
    ).resolves.toBe(2);
    expect(documents.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["sindico@x.com", "conselho@x.com"],
        message: "Segue o mapa.",
        replyTo: { email: "ana@condominio.test", name: "Ana" },
        file: expect.objectContaining({
          name: "mapa-de-cotacao-SC-0001.pdf",
          contentType: "application/pdf",
        }),
      }),
    );
  });

  it("refuses no address, too many, an empty message and too many sends", async () => {
    const { share, documents } = setup();
    await expect(share.byEmail(actor, "r1", [], "Oi")).rejects.toThrow();
    await expect(
      share.byEmail(
        actor,
        "r1",
        ["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com", "f@x.com"],
        "Oi",
      ),
    ).rejects.toThrow();
    await expect(
      share.byEmail(actor, "r1", ["a@x.com"], "  "),
    ).rejects.toThrow();
    await expect(
      setup(31).share.byEmail(actor, "r1", ["a@x.com"], "Oi"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PURCHASE_SHARE_LIMIT" }),
    });
    expect(documents.send).not.toHaveBeenCalled();
  });
});
