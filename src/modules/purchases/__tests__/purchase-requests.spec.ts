import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { NotificationType } from "@/modules/notifications/domain/notification";
import type { PurchaseRequestRepositoryPort } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import {
  type PurchaseRequestInput,
  validateCancelReason,
  validatePurchaseRequestInput,
} from "@/modules/purchases/application/purchase-request-input";
import {
  requestCancelledNotices,
  requestCreatedNotices,
} from "@/modules/purchases/application/purchase-request-notices";
import type { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import { CancelPurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/cancel-purchase-request.use-case";
import { withSpace } from "@/modules/purchases/application/purchase-request-space";
import type { SpaceLookupService } from "@/modules/spaces/application/space-lookup.service";
import { UpdatePurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/update-purchase-request.use-case";
import { Category } from "@/modules/catalog/domain/category";
import {
  PurchasePriority,
  type PurchaseRequest,
  PurchaseRequestStatus,
  requestCode,
} from "@/modules/purchases/domain/purchase-request";
import type { ClockPort } from "@/shared/application/ports/clock.port";

const TODAY = "2026-11-21";

const input = (
  overrides: Partial<PurchaseRequestInput> = {},
): PurchaseRequestInput => ({
  title: "  Lâmpadas   do hall ",
  categories: [Category.OTHER, Category.ELECTRICAL],
  categoryOther: "  Brindes  ",
  items: [
    { productId: "p1", quantity: 12, unit: " un ", note: "  bocal   E27 " },
  ],
  ...overrides,
});

const request = (
  overrides: Partial<PurchaseRequest> = {},
): PurchaseRequest => ({
  id: "r1",
  condominiumId: "c1",
  number: 7,
  title: "Lâmpadas do hall",
  description: null,
  categories: [Category.ELECTRICAL],
  categoryOther: null,
  priority: PurchasePriority.NORMAL,
  spaceId: null,
  location: null,
  neededBy: null,
  status: PurchaseRequestStatus.OPEN,
  requestedById: "gate",
  requestedByName: "Carlos",
  items: [
    {
      id: "i1",
      productId: "p1",
      productName: "Lâmpada",
      quantity: 12,
      unit: "un",
      brandId: null,
      brandName: null,
      note: null,
    },
  ],
  cancelReason: null,
  cancelledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("validatePurchaseRequestInput", () => {
  it("normalizes the texts, defaults the priority and orders the categories", () => {
    expect(validatePurchaseRequestInput(input(), TODAY)).toEqual({
      title: "Lâmpadas do hall",
      description: null,
      categories: [Category.ELECTRICAL, Category.OTHER],
      categoryOther: "Brindes",
      priority: PurchasePriority.NORMAL,
      spaceId: null,
      location: null,
      neededBy: null,
      items: [
        {
          productId: "p1",
          quantity: 12,
          unit: "un",
          brandId: null,
          note: "bocal E27",
        },
      ],
    });
  });

  it("drops the typed text without OTHER", () => {
    expect(
      validatePurchaseRequestInput(
        input({ categories: [Category.CLEANING], categoryOther: "x" }),
        TODAY,
      ).categoryOther,
    ).toBeNull();
  });

  it.each([
    ["a short title", { title: "ab" }],
    ["OTHER without text", { categories: [Category.OTHER], categoryOther: "" }],
    ["no items", { items: [] }],
    [
      "a zero quantity",
      { items: [{ productId: "p1", quantity: 0, unit: "m" }] },
    ],
    [
      "three decimals",
      { items: [{ productId: "p1", quantity: 1.555, unit: "m" }] },
    ],
    [
      "an item without unit",
      { items: [{ productId: "p1", quantity: 1, unit: " " }] },
    ],
    ["a past date", { neededBy: "2026-11-20" }],
    ["an invalid date", { neededBy: "2026-02-30" }],
  ])("refuses %s", (_label, overrides) => {
    expect(() =>
      validatePurchaseRequestInput(input(overrides), TODAY),
    ).toThrow();
  });

  it("accepts a past date only when it is the one already saved", () => {
    expect(
      validatePurchaseRequestInput(
        input({ neededBy: "2026-11-10" }),
        TODAY,
        "2026-11-10",
      ).neededBy,
    ).toBe("2026-11-10");
  });

  it("asks a cancel reason of 3 to 300 characters", () => {
    expect(() => validateCancelReason(" a ")).toThrow();
    expect(validateCancelReason("  Comprado  por fora ")).toBe(
      "Comprado por fora",
    );
  });
});

describe("purchase request notices", () => {
  it("tells the managers but not whoever asked", () => {
    const notices = requestCreatedNotices(request(), ["gate", "m1", "m2"]);
    expect(notices.map((notice) => notice.payload.userId)).toEqual([
      "m1",
      "m2",
    ]);
    expect(notices[0].payload).toMatchObject({
      type: NotificationType.PURCHASE_REQUEST_CREATED,
      title: "Nova solicitação de compra SC-0007",
    });
  });

  it("tells the requester when someone else cancels", () => {
    expect(
      requestCancelledNotices(request(), { id: "gate", name: "Carlos" }, "x"),
    ).toEqual([]);
    expect(
      requestCancelledNotices(
        request(),
        { id: "m1", name: "Ana" },
        "Sem verba",
      )[0].payload,
    ).toMatchObject({
      userId: "gate",
      type: NotificationType.PURCHASE_REQUEST_CANCELLED,
    });
  });

  it("formats the code with four digits", () => {
    expect(requestCode(7)).toBe("SC-0007");
    expect(requestCode(12345)).toBe("SC-12345");
  });
});

describe("purchase request use cases", () => {
  const actor = { id: "m1", name: "Ana" } as AuthenticatedUser;
  const clock = {
    now: () => new Date("2026-11-21T12:00:00Z"),
    timeZone: "America/Sao_Paulo",
  } as ClockPort;

  const setup = (current: PurchaseRequest) => {
    const repository = {
      update: jest.fn((id: string) => Promise.resolve(request({ id }))),
      cancel: jest.fn(() =>
        Promise.resolve(request({ status: PurchaseRequestStatus.CANCELLED })),
      ),
    } as unknown as jest.Mocked<PurchaseRequestRepositoryPort>;
    const access = {
      loadRequest: jest.fn().mockResolvedValue(current),
    } as unknown as PurchasesAccessService;
    const audit = {
      stamp: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditTrailService;
    return { repository, access, audit };
  };

  it("edits and cancels only while waiting for quotes", async () => {
    const quoting = setup(request({ status: PurchaseRequestStatus.QUOTING }));
    await expect(
      new UpdatePurchaseRequestUseCase(
        quoting.repository,
        { activeIds: jest.fn() } as never,
        { activeIds: jest.fn() } as never,
        quoting.access,
        { find: jest.fn() } as never,
        quoting.audit,
        clock,
      ).execute(actor, "r1", input()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PURCHASE_REQUEST_LOCKED" }),
    });
    await expect(
      new CancelPurchaseRequestUseCase(
        quoting.repository,
        quoting.access,
        quoting.audit,
        clock,
      ).execute(actor, "r1", "Sem verba"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PURCHASE_REQUEST_LOCKED" }),
    });
    expect(quoting.repository.update).not.toHaveBeenCalled();
    expect(quoting.repository.cancel).not.toHaveBeenCalled();
  });

  it("cancels an open request telling the requester", async () => {
    const open = setup(request());
    await new CancelPurchaseRequestUseCase(
      open.repository,
      open.access,
      open.audit,
      clock,
    ).execute(actor, "r1", "  Sem verba ");
    expect(open.repository.cancel).toHaveBeenCalledWith(
      "r1",
      "m1",
      "Sem verba",
      expect.any(Date),
      [
        expect.objectContaining({
          payload: expect.objectContaining({ userId: "gate" }),
        }),
      ],
    );
  });
});

describe("withSpace", () => {
  const spaces = (
    space: { id: string; name: string; active: boolean } | null,
  ) =>
    ({
      find: jest.fn().mockResolvedValue(space),
    }) as unknown as SpaceLookupService;
  const data = (spaceId: string | null) => ({
    ...validatePurchaseRequestInput(input({ location: "Portaria" }), TODAY),
    spaceId,
  });

  it("uses the space's name as the location", async () => {
    await expect(
      withSpace(
        spaces({ id: "s1", name: "Salão de festas", active: true }),
        "c1",
        data("s1"),
      ),
    ).resolves.toMatchObject({ spaceId: "s1", location: "Salão de festas" });
  });

  it("keeps the place typed without a space", async () => {
    await expect(
      withSpace(spaces(null), "c1", data(null)),
    ).resolves.toMatchObject({
      spaceId: null,
      location: "Portaria",
    });
  });

  it("refuses an inactive space unless it is the current one", async () => {
    const inactive = spaces({ id: "s1", name: "Quadra", active: false });
    await expect(withSpace(inactive, "c1", data("s1"))).rejects.toMatchObject({
      response: expect.objectContaining({ code: "PURCHASE_SPACE_UNAVAILABLE" }),
    });
    await expect(
      withSpace(inactive, "c1", data("s1"), "s1"),
    ).resolves.toMatchObject({
      location: "Quadra",
    });
  });
});
