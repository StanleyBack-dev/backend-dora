import { writeFileSync } from "node:fs";
import type { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { PurchaseOrderRepositoryPort } from "@/modules/purchases/application/ports/purchase-order-repository.port";
import type { PurchaseQuoteRepositoryPort } from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import { missingPermission } from "@/modules/purchases/application/purchase-errors";
import type { PurchaseOrderFiles } from "@/modules/purchases/application/purchase-order-files";
import type {
  OrderAccess,
  PurchasesAccessService,
} from "@/modules/purchases/application/purchases-access.service";
import type { ListPurchaseOrdersUseCase } from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import { CancelPurchaseOrderUseCase } from "@/modules/purchases/application/use-cases/cancel-purchase-order.use-case";
import { ReschedulePurchaseInstallmentUseCase } from "@/modules/purchases/application/use-cases/reschedule-purchase-installment.use-case";
import { SendPurchaseOrderEmailUseCase } from "@/modules/purchases/application/use-cases/send-purchase-order-email.use-case";
import type { PurchaseDocumentMailer } from "@/modules/purchases/application/purchase-document-mailer";
import { PayPurchaseInstallmentUseCase } from "@/modules/purchases/application/use-cases/pay-purchase-installment.use-case";
import { PlacePurchaseOrderUseCase } from "@/modules/purchases/application/use-cases/place-purchase-order.use-case";
import { PurchaseOrderPdfUseCase } from "@/modules/purchases/application/use-cases/purchase-order-pdf.use-case";
import { RatePurchaseSupplierUseCase } from "@/modules/purchases/application/use-cases/rate-purchase-supplier.use-case";
import { RecordPurchaseReceiptUseCase } from "@/modules/purchases/application/use-cases/record-purchase-receipt.use-case";
import {
  fullyReceived,
  monthlyDueDays,
  orderStatus,
  pendingByItem,
  type PurchaseOrder,
} from "@/modules/purchases/domain/purchase-order";
import {
  PaymentMethod,
  type PurchaseQuote,
} from "@/modules/purchases/domain/purchase-quote";
import {
  PurchasePriority,
  type PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import { PdfLibPurchaseOrderRenderer } from "@/modules/purchases/infrastructure/pdf/pdf-lib-purchase-order.renderer";
import type { SupplierRepositoryPort } from "@/modules/suppliers/application/ports/supplier-repository.port";
import {
  type Supplier,
  SupplierDocumentType,
} from "@/modules/suppliers/domain/supplier";
import type { ClockPort } from "@/shared/application/ports/clock.port";

const manager = { id: "ana", name: "Ana" } as AuthenticatedUser;
const gate = { id: "gate", name: "Portaria" } as AuthenticatedUser;
const clock = {
  now: () => new Date("2026-11-23T15:00:00Z"),
  timeZone: "America/Sao_Paulo",
} as ClockPort;

const MANAGE: OrderAccess = { condominiumId: "c1", manage: true, money: true };
const GATE: OrderAccess = { condominiumId: "c1", manage: false, money: false };

const request = (
  overrides: Partial<PurchaseRequest> = {},
): PurchaseRequest => ({
  id: "r1",
  condominiumId: "c1",
  number: 8,
  title: "Lâmpadas do hall",
  description: null,
  categories: [],
  categoryOther: null,
  priority: PurchasePriority.NORMAL,
  spaceId: null,
  location: "Hall do bloco A",
  neededBy: null,
  status: PurchaseRequestStatus.APPROVED,
  requestedById: "joao",
  requestedByName: "João",
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
    {
      id: "i2",
      productId: "p2",
      productName: "Reator",
      quantity: 2,
      unit: "un",
      brandId: null,
      brandName: "Philips",
      note: "Bivolt",
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

const quote = (overrides: Partial<PurchaseQuote> = {}): PurchaseQuote => ({
  id: "q1",
  requestId: "r1",
  supplierId: "s1",
  supplierName: "Luz Forte",
  items: [
    { requestItemId: "i1", unitPriceCents: 1_000 },
    { requestItemId: "i2", unitPriceCents: 5_000 },
  ],
  shippingCents: 0,
  charges: [],
  chargesCents: 0,
  discountCents: 0,
  discountPercentBp: null,
  interestRateBp: null,
  deliveryDays: 3,
  paymentMethod: PaymentMethod.BOLETO,
  installments: 3,
  paymentTerms: null,
  validUntil: null,
  notes: null,
  fileKey: null,
  fileIsPdf: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const order = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: "o1",
  condominiumId: "c1",
  requestId: "r1",
  quoteId: "q1",
  supplierId: "s1",
  number: 3,
  supplierName: "Luz Forte",
  itemsCents: 20_000,
  totalCents: 20_000,
  paymentMethod: PaymentMethod.PIX,
  paymentTerms: null,
  expectedOn: "2026-11-26",
  notes: null,
  orderedById: "ana",
  orderedByName: "Ana",
  orderedAt: new Date("2026-11-20T12:00:00Z"),
  completedAt: null,
  receipts: [],
  installments: [
    {
      id: "n1",
      orderId: "o1",
      number: 1,
      amountCents: 20_000,
      dueOn: "2026-11-30",
      paidOn: null,
      paidById: null,
      paidByName: null,
      proofKey: null,
      proofIsPdf: null,
      note: null,
    },
  ],
  rating: null,
  ...overrides,
});

/** The access service: refuses as the real one does for the level asked. */
const access = (orderAccess: OrderAccess) =>
  ({
    orderAccess: jest.fn((_actor: unknown, need = "view") =>
      (need === "manage" && !orderAccess.manage) ||
      (need === "money" && !orderAccess.money)
        ? Promise.reject(missingPermission())
        : Promise.resolve(orderAccess),
    ),
    managers: jest.fn().mockResolvedValue(["ana", "carlos"]),
  }) as unknown as PurchasesAccessService;

const listing = (current: PurchaseRequest) =>
  ({
    loadRequest: jest.fn().mockResolvedValue(current),
    view: jest.fn().mockResolvedValue({ request: current }),
  }) as unknown as ListPurchaseOrdersUseCase;

const files = () =>
  ({
    store: jest.fn().mockResolvedValue({ key: null, isPdf: null }),
    drop: jest.fn(),
  }) as unknown as jest.Mocked<PurchaseOrderFiles>;

const audit = { stamp: jest.fn() } as unknown as AuditTrailService;
const outbox = { kick: jest.fn() } as unknown as OutboxDispatcher;

describe("purchase order domain", () => {
  it("keeps the day of the month in the monthly due days", () => {
    expect(monthlyDueDays("2026-01-31", 4)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
    expect(monthlyDueDays("2026-11-10", 3)).toEqual([
      "2026-11-10",
      "2026-12-10",
      "2027-01-10",
    ]);
  });

  it("adds the deliveries up, item by item", () => {
    const items = [
      { id: "i1", quantity: 10 },
      { id: "i2", quantity: 2.5 },
    ];
    const receipts = [
      { items: [{ requestItemId: "i1", quantity: 4 }] },
      {
        items: [
          { requestItemId: "i1", quantity: 6 },
          { requestItemId: "i2", quantity: 1.25 },
        ],
      },
    ];
    expect([...pendingByItem(items, receipts)]).toEqual([
      ["i1", 0],
      ["i2", 1.25],
    ]);
    expect(fullyReceived(items, receipts)).toBe(false);
    expect(
      fullyReceived(items, [
        ...receipts,
        { items: [{ requestItemId: "i2", quantity: 1.25 }] },
      ]),
    ).toBe(true);
  });

  it("completes only when received and paid", () => {
    expect(orderStatus(false, true)).toBe(PurchaseRequestStatus.ORDERED);
    expect(orderStatus(true, false)).toBe(PurchaseRequestStatus.RECEIVED);
    expect(orderStatus(true, true)).toBe(PurchaseRequestStatus.COMPLETED);
  });
});

describe("PlacePurchaseOrderUseCase", () => {
  const setup = (current = request(), chosen = quote()) => {
    const orders = {
      create: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<PurchaseOrderRepositoryPort>;
    const useCase = new PlacePurchaseOrderUseCase(
      {
        find: jest.fn().mockResolvedValue(chosen),
      } as unknown as PurchaseQuoteRepositoryPort,
      orders,
      listing(current),
      access(MANAGE),
      audit,
      outbox,
      clock,
    );
    return { orders, useCase };
  };

  it("keeps the chosen quote and sets the installments month by month", async () => {
    const { orders, useCase } = setup();
    await useCase.place(manager, "r1", {
      expectedOn: "2026-11-26",
      firstDueOn: "2026-12-10",
      notes: "  Entregar   na portaria ",
    });
    const [placed, installments, notices] = orders.create.mock.calls[0];
    expect(placed).toMatchObject({
      requestId: "r1",
      quoteId: "q1",
      supplierId: "s1",
      supplierName: "Luz Forte",
      itemsCents: 20_000,
      totalCents: 20_000,
      paymentMethod: PaymentMethod.BOLETO,
      expectedOn: "2026-11-26",
      notes: "Entregar na portaria",
      orderedById: "ana",
    });
    expect(installments).toEqual([
      { number: 1, amountCents: 6_666, dueOn: "2026-12-10" },
      { number: 2, amountCents: 6_666, dueOn: "2027-01-10" },
      { number: 3, amountCents: 6_668, dueOn: "2027-02-10" },
    ]);
    // Who asked for it and the other manager, with the number it got.
    const drafts = notices(4);
    expect(drafts.map((draft) => draft.payload.userId).sort()).toEqual([
      "carlos",
      "joao",
    ]);
    const to = (userId: string) =>
      drafts.find((draft) => draft.payload.userId === userId)?.payload;
    expect(to("carlos")).toMatchObject({
      type: NotificationType.PURCHASE_ORDERED,
      title: "Pedido OC-0004 feito",
      link: "/compras/pedidos/r1",
    });
    expect(to("joao")?.link).toBe("/compras/pedidos/r1");
  });

  it("is paid at once without installments, with interest when quoted", async () => {
    const { orders, useCase } = setup(
      request(),
      quote({ installments: null, paymentMethod: PaymentMethod.PIX }),
    );
    await useCase.place(manager, "r1", {
      expectedOn: null,
      firstDueOn: "2026-11-23",
      notes: null,
    });
    expect(orders.create.mock.calls[0][1]).toEqual([
      { number: 1, amountCents: 20_000, dueOn: "2026-11-23" },
    ]);

    const withInterest = setup(
      request(),
      quote({ installments: 2, interestRateBp: 200 }),
    );
    await withInterest.useCase.place(manager, "r1", {
      expectedOn: null,
      firstDueOn: "2026-12-01",
      notes: null,
    });
    const [placed, parts] = withInterest.orders.create.mock.calls[0];
    expect(parts.map((part) => part.amountCents)).toEqual([10_301, 10_301]);
    expect(placed.totalCents).toBe(20_602);
  });

  it("refuses a request not approved, a past due day or a partial quote", async () => {
    await expect(
      setup(request({ status: PurchaseRequestStatus.ORDERED })).useCase.place(
        manager,
        "r1",
        { expectedOn: null, firstDueOn: "2026-12-01", notes: null },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PURCHASE_NOT_APPROVED" }),
    });
    await expect(
      setup().useCase.place(manager, "r1", {
        expectedOn: null,
        firstDueOn: "2026-11-22",
        notes: null,
      }),
    ).rejects.toThrow("O vencimento deve ser de hoje em diante.");
    await expect(
      setup(
        request(),
        quote({ items: [{ requestItemId: "i1", unitPriceCents: 1_000 }] }),
      ).useCase.place(manager, "r1", {
        expectedOn: null,
        firstDueOn: "2026-12-01",
        notes: null,
      }),
    ).rejects.toThrow("não tem preço para todos os itens");
  });
});

describe("RecordPurchaseReceiptUseCase", () => {
  const ordered = request({ status: PurchaseRequestStatus.ORDERED });
  const setup = (current = order(), who = GATE) => {
    const orders = {
      findByRequest: jest.fn().mockResolvedValue(current),
      addReceipt: jest.fn().mockResolvedValue(PurchaseRequestStatus.ORDERED),
      removeReceipt: jest.fn().mockResolvedValue("purchase-orders/c1/nf.pdf"),
    } as unknown as jest.Mocked<PurchaseOrderRepositoryPort>;
    const stored = files();
    const useCase = new RecordPurchaseReceiptUseCase(
      orders,
      listing(ordered),
      stored,
      access(who),
      audit,
      outbox,
      clock,
    );
    return { orders, stored, useCase };
  };
  const input = {
    receivedOn: "2026-11-23",
    invoiceNumber: " 12345 ",
    invoiceCents: null,
    invoiceDate: null,
    note: null,
  };

  it("lets the gate record part of the delivery", async () => {
    const { orders, useCase } = setup();
    await useCase.add(
      gate,
      "r1",
      {
        ...input,
        items: [
          { requestItemId: "i1", quantity: 4 },
          { requestItemId: "i2", quantity: 0 },
        ],
      },
      null,
    );
    const [orderId, receipt, notices] = orders.addReceipt.mock.calls[0];
    expect(orderId).toBe("o1");
    expect(receipt).toMatchObject({
      receivedOn: "2026-11-23",
      items: [{ requestItemId: "i1", quantity: 4 }],
      invoiceNumber: "12345",
      receivedById: "gate",
    });
    expect(notices.map((notice) => notice.payload.userId).sort()).toEqual([
      "ana",
      "carlos",
      "joao",
    ]);
    expect(notices[0].payload.title).toBe("Entrega parcial do OC-0003");
  });

  it("tells it is completed when the last delivery comes already paid", async () => {
    const paid = order();
    paid.installments[0].paidOn = "2026-11-20";
    const { orders, useCase } = setup(paid, MANAGE);
    await useCase.add(
      manager,
      "r1",
      {
        ...input,
        items: [
          { requestItemId: "i1", quantity: 10 },
          { requestItemId: "i2", quantity: 2 },
        ],
      },
      null,
    );
    const types = orders.addReceipt.mock.calls[0][2].map(
      (notice) => notice.payload.type,
    );
    expect(types).toContain(NotificationType.PURCHASE_RECEIVED);
    expect(types).toContain(NotificationType.PURCHASE_COMPLETED);
  });

  it("refuses more than is left to arrive, or a day out of range", async () => {
    const { orders, useCase } = setup(
      order({
        receipts: [
          {
            id: "d1",
            orderId: "o1",
            receivedOn: "2026-11-21",
            items: [{ requestItemId: "i1", quantity: 8 }],
            invoiceNumber: null,
            invoiceCents: null,
            invoiceDate: null,
            fileKey: null,
            fileIsPdf: null,
            note: null,
            receivedById: "gate",
            receivedByName: "Portaria",
            createdAt: new Date(),
          },
        ],
      }),
    );
    await expect(
      useCase.add(
        gate,
        "r1",
        { ...input, items: [{ requestItemId: "i1", quantity: 3 }] },
        null,
      ),
    ).rejects.toThrow("passa do que falta chegar");
    await expect(
      useCase.add(
        gate,
        "r1",
        {
          ...input,
          receivedOn: "2026-11-19",
          items: [{ requestItemId: "i1", quantity: 1 }],
        },
        null,
      ),
    ).rejects.toThrow("do dia do pedido até hoje");
    expect(orders.addReceipt).not.toHaveBeenCalled();
  });

  it("removes a delivery only by the management or whoever recorded it", async () => {
    const withReceipt = order({
      receipts: [
        {
          id: "d1",
          orderId: "o1",
          receivedOn: "2026-11-21",
          items: [{ requestItemId: "i1", quantity: 2 }],
          invoiceNumber: null,
          invoiceCents: null,
          invoiceDate: null,
          fileKey: "purchase-orders/c1/nf.pdf",
          fileIsPdf: true,
          note: null,
          receivedById: "zelador",
          receivedByName: "Zelador",
          createdAt: new Date(),
        },
      ],
    });
    await expect(
      setup(withReceipt).useCase.remove(gate, "r1", "d1"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ACCESS_MISSING_PERMISSION" }),
    });
    const { orders, stored, useCase } = setup(withReceipt, MANAGE);
    await useCase.remove(manager, "r1", "d1");
    expect(orders.removeReceipt).toHaveBeenCalledWith("o1", "d1");
    expect(stored.drop).toHaveBeenCalledWith("purchase-orders/c1/nf.pdf");
  });
});

describe("PayPurchaseInstallmentUseCase", () => {
  const received = request({ status: PurchaseRequestStatus.RECEIVED });
  const setup = (current = order(), who = MANAGE) => {
    const orders = {
      findByRequest: jest.fn().mockResolvedValue(current),
      payInstallment: jest.fn().mockResolvedValue(true),
      unpayInstallment: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<PurchaseOrderRepositoryPort>;
    const useCase = new PayPurchaseInstallmentUseCase(
      orders,
      listing(received),
      files(),
      access(who),
      audit,
      outbox,
      clock,
    );
    return { orders, useCase };
  };
  const fullDelivery = {
    id: "d1",
    orderId: "o1",
    receivedOn: "2026-11-21",
    items: [
      { requestItemId: "i1", quantity: 10 },
      { requestItemId: "i2", quantity: 2 },
    ],
    invoiceNumber: null,
    invoiceCents: null,
    invoiceDate: null,
    fileKey: null,
    fileIsPdf: null,
    note: null,
    receivedById: "gate",
    receivedByName: "Portaria",
    createdAt: new Date(),
  };

  it("completes the purchase with the last payment of a received one", async () => {
    const { orders, useCase } = setup(order({ receipts: [fullDelivery] }));
    await useCase.pay(
      manager,
      "r1",
      "n1",
      { paidOn: "2026-11-23", note: "PIX" },
      null,
    );
    const [, , payment, notices] = orders.payInstallment.mock.calls[0];
    expect(payment).toMatchObject({
      paidOn: "2026-11-23",
      paidById: "ana",
      note: "PIX",
    });
    expect(notices[0].payload).toMatchObject({
      type: NotificationType.PURCHASE_COMPLETED,
      title: "Compra OC-0003 concluída",
    });
  });

  it("refuses the gate, a future day or an installment already paid", async () => {
    await expect(
      setup(order(), GATE).useCase.pay(
        gate,
        "r1",
        "n1",
        { paidOn: "2026-11-23", note: null },
        null,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "ACCESS_MISSING_PERMISSION" }),
    });
    await expect(
      setup().useCase.pay(
        manager,
        "r1",
        "n1",
        { paidOn: "2026-11-24", note: null },
        null,
      ),
    ).rejects.toThrow("não pode ser no futuro");
    const paid = order();
    paid.installments[0].paidOn = "2026-11-21";
    await expect(
      setup(paid).useCase.pay(
        manager,
        "r1",
        "n1",
        { paidOn: "2026-11-23", note: null },
        null,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PURCHASE_ORDER_CHANGED" }),
    });
  });
});

describe("RatePurchaseSupplierUseCase", () => {
  const setup = (status: PurchaseRequestStatus) => {
    const suppliers = {
      rate: jest.fn(),
    } as unknown as jest.Mocked<SupplierRepositoryPort>;
    const useCase = new RatePurchaseSupplierUseCase(
      {
        findByRequest: jest.fn().mockResolvedValue(order()),
      } as unknown as PurchaseOrderRepositoryPort,
      suppliers,
      listing(request({ status })),
      access(MANAGE),
      audit,
    );
    return { suppliers, useCase };
  };

  it("rates the supplier of a completed purchase", async () => {
    const { suppliers, useCase } = setup(PurchaseRequestStatus.COMPLETED);
    await useCase.rate(manager, "r1", 4, " Entregou no prazo ");
    expect(suppliers.rate).toHaveBeenCalledWith(
      "s1",
      { source: "PURCHASE_ORDER", sourceId: "o1" },
      4,
      "Entregou no prazo",
      "ana",
    );
    await expect(useCase.rate(manager, "r1", 6, null)).rejects.toThrow(
      "de 1 a 5",
    );
  });

  it("waits for the purchase to be completed", async () => {
    const { suppliers, useCase } = setup(PurchaseRequestStatus.RECEIVED);
    await expect(useCase.rate(manager, "r1", 5, null)).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PURCHASE_NOT_COMPLETED" }),
    });
    expect(suppliers.rate).not.toHaveBeenCalled();
  });
});

describe("PurchaseOrderPdfUseCase", () => {
  it("writes the order with prices, totals and due days", async () => {
    const useCase = new PurchaseOrderPdfUseCase(
      {} as PurchaseOrderRepositoryPort,
      {} as PurchaseQuoteRepositoryPort,
      {} as SupplierRepositoryPort,
      {} as ListPurchaseOrdersUseCase,
      {} as PurchasesAccessService,
      {} as never,
      {} as never,
      clock,
    );
    const supplier = {
      name: "Luz Forte Comércio Ltda",
      tradeName: "Luz Forte",
      documentType: SupplierDocumentType.CNPJ,
      document: "11222333000181",
      contactName: "Marta",
      phone: "11987654321",
      email: "vendas@luzforte.com",
    } as Supplier;
    const input = useCase.input(
      request({ status: PurchaseRequestStatus.ORDERED }),
      order(),
      quote({ shippingCents: 1_500 }),
      supplier,
      { name: "Residencial Aurora", document: null, city: "São Paulo/SP" },
    );
    expect(input.code).toBe("OC-0003");
    expect(input.supplier.facts).toContainEqual(["CNPJ", "11.222.333/0001-81"]);
    expect(input.supplier.facts).toContainEqual([
      "Telefone",
      "(11) 98765-4321",
    ]);
    // Currency comes with a no-break space after "R$".
    const plain = (rows: [string, string | null][]) =>
      rows.map(([label, value]) => [
        label,
        value?.split(String.fromCharCode(160)).join(" "),
      ]);
    expect(plain(input.items)[1]).toEqual([
      "2. Reator · Philips · Bivolt",
      "2 un × R$ 50,00 = R$ 100,00",
    ]);
    expect(plain(input.totals)).toContainEqual(["Frete", "R$ 15,00"]);
    expect(plain(input.payment)).toContainEqual([
      "Vencimento",
      "R$ 200,00 · vence em 30/11/2026",
    ]);
    const pdf = await new PdfLibPurchaseOrderRenderer().render(input);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    if (process.env.SAMPLE_OUT) writeFileSync(process.env.SAMPLE_OUT, pdf);
  });
});

describe("CancelPurchaseOrderUseCase", () => {
  const setup = (current = order()) => {
    const orders = {
      findByRequest: jest.fn().mockResolvedValue(current),
      cancel: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<PurchaseOrderRepositoryPort>;
    const useCase = new CancelPurchaseOrderUseCase(
      orders,
      listing(request({ status: PurchaseRequestStatus.ORDERED })),
      access(MANAGE),
      audit,
      outbox,
      clock,
    );
    return { orders, useCase };
  };

  it("cancels an order with nothing received nor paid, telling the others", async () => {
    const { orders, useCase } = setup();
    await useCase.cancel(manager, "r1", "  Fornecedor sem estoque ");
    const [orderId, cancel, notices] = orders.cancel.mock.calls[0];
    expect(orderId).toBe("o1");
    expect(cancel).toEqual({
      by: "ana",
      reason: "Fornecedor sem estoque",
      backToQuotes: false,
    });
    expect(notices[0].payload).toMatchObject({
      type: NotificationType.PURCHASE_ORDER_CANCELLED,
      title: "Pedido OC-0003 cancelado",
    });
  });

  it("can send the purchase back to the quotes, with no order page left", async () => {
    const { orders, useCase } = setup();
    await expect(
      useCase.cancel(manager, "r1", "Fornecedor sem estoque", true),
    ).resolves.toBeNull();
    const [, cancel, notices] = orders.cancel.mock.calls[0];
    expect(cancel).toMatchObject({ backToQuotes: true });
    expect(notices[0].payload).toMatchObject({
      link: "/compras/cotacoes/r1",
    });
  });

  it("refuses once something was paid, or without a reason", async () => {
    const paid = order();
    paid.installments[0].paidOn = "2026-11-21";
    await expect(
      setup(paid).useCase.cancel(manager, "r1", "Desistimos"),
    ).rejects.toThrow("não pode mais ser cancelado");
    await expect(setup().useCase.cancel(manager, "r1", "ok")).rejects.toThrow(
      "Diga o motivo",
    );
  });
});

describe("ReschedulePurchaseInstallmentUseCase", () => {
  const setup = () => {
    const orders = {
      findByRequest: jest.fn().mockResolvedValue(order()),
      reschedule: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<PurchaseOrderRepositoryPort>;
    const useCase = new ReschedulePurchaseInstallmentUseCase(
      orders,
      listing(request({ status: PurchaseRequestStatus.ORDERED })),
      access(MANAGE),
      audit,
      clock,
    );
    return { orders, useCase };
  };

  it("moves the due day from the order day on", async () => {
    const { orders, useCase } = setup();
    await useCase.reschedule(manager, "r1", "n1", "2026-12-15");
    expect(orders.reschedule).toHaveBeenCalledWith("o1", "n1", "2026-12-15");
    await expect(
      useCase.reschedule(manager, "r1", "n1", "2026-11-19"),
    ).rejects.toThrow("do dia do pedido em diante");
  });
});

describe("SendPurchaseOrderEmailUseCase", () => {
  it("sends the purchase order PDF to the supplier", async () => {
    const pdf = {
      render: jest.fn().mockResolvedValue({
        fileName: "ordem-de-compra-OC-0003.pdf",
        content: Buffer.from("%PDF-"),
        code: "OC-0003",
        request: "SC-0008 · Lâmpadas do hall",
        total: "R$ 200,00",
        condominiumName: "Residencial Aurora",
      }),
    } as unknown as PurchaseOrderPdfUseCase;
    const mailer = {
      check: jest.fn().mockReturnValue({ to: ["vendas@luz.com"], text: "Oi" }),
      send: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<PurchaseDocumentMailer>;
    const sent = await new SendPurchaseOrderEmailUseCase(pdf, mailer).send(
      manager,
      "r1",
      ["vendas@luz.com"],
      "Oi",
    );
    expect(sent).toBe(1);
    expect(mailer.send.mock.calls[0][2]).toMatchObject({
      subject: "Ordem de compra OC-0003 · Residencial Aurora",
      fileName: "ordem-de-compra-OC-0003.pdf",
      tag: "purchase-order",
    });
  });
});
