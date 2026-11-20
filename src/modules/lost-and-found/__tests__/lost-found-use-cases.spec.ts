import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AppException } from "@/common/exceptions/app-exception";
import type { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import type { LostFoundDeclarationService } from "@/modules/lost-and-found/application/lost-found-declaration.service";
import type {
  FoundItem,
  FoundItemClaim,
  FoundItemRepositoryPort,
  NewFoundItem,
  NewFoundItemReturn,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import { ClaimFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/claim-found-item.use-case";
import { CloseFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/close-found-item.use-case";
import { DecideClaimUseCase } from "@/modules/lost-and-found/application/use-cases/decide-claim.use-case";
import { RegisterFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/register-found-item.use-case";
import { ReturnFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/return-found-item.use-case";
import {
  ClaimStatus,
  FoundItemCategory,
  FoundItemStatus,
  returnDeclaration,
} from "@/modules/lost-and-found/domain/found-item";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { ImageProcessorPort } from "@/shared/application/ports/image-processor.port";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";
import { LocationStatus } from "@/shared/domain/signature/signature-capture";

const now = new Date("2026-11-20T12:00:00Z");
const clock = { now: () => now, timeZone: "America/Sao_Paulo" } as ClockPort;
const staff = {
  id: "gate-1",
  name: "João",
  group: "CONCIERGE",
} as AuthenticatedUser;
const resident = { id: "resident-1" } as AuthenticatedUser;

const kept = (overrides: Partial<FoundItem> = {}) =>
  ({
    id: "item-1",
    condominiumId: "condo-1",
    category: FoundItemCategory.KEYS,
    title: "Chave com chaveiro azul",
    foundLocation: "Salão de festas",
    foundAt: new Date("2026-11-19T15:00:00Z"),
    keepUntil: new Date("2027-02-17T15:00:00Z"),
    status: FoundItemStatus.FOUND,
    returnedToId: null,
    pendingClaims: 0,
    ...overrides,
  }) as FoundItem;

const claim = (overrides: Partial<FoundItemClaim> = {}) =>
  ({
    id: "claim-1",
    itemId: "item-1",
    itemTitle: "Chave com chaveiro azul",
    itemStatus: FoundItemStatus.FOUND,
    condominiumId: "condo-1",
    userId: "resident-1",
    userName: "Maria",
    unitLabel: "Bloco A · 101",
    message: "Chave do carro com chaveiro azul da Disney",
    status: ClaimStatus.PENDING,
    decisionNote: null,
    ...overrides,
  }) as FoundItemClaim;

const access = (item: FoundItem) =>
  ({
    condominiumOf: async () => "condo-1",
    loadVisible: async () => item,
    staff: async () => ["gate-1", "manager-1"],
  }) as unknown as LostFoundAccessService;

describe("RegisterFoundItemUseCase", () => {
  function setup() {
    const created: NewFoundItem[] = [];
    const items = {
      create: async (item: NewFoundItem) => {
        created.push(item);
        return { id: "item-1", ...item } as unknown as FoundItem;
      },
    } as unknown as FoundItemRepositoryPort;
    return {
      useCase: new RegisterFoundItemUseCase(
        items,
        access(kept()),
        {} as ImageProcessorPort,
        {} as ObjectStoragePort,
        clock,
      ),
      created,
    };
  }

  it("keeps it 90 days and hides a document's photo by default", async () => {
    const { useCase, created } = setup();
    await useCase.execute(staff, {
      category: FoundItemCategory.DOCUMENT,
      title: " RG  de Maria ",
      foundLocation: "Academia",
      storageLocation: "Portaria",
      foundAt: new Date("2026-11-20T10:00:00Z"),
    });
    expect(created[0]).toMatchObject({
      title: "RG de Maria",
      photoHidden: true,
      keepUntil: new Date("2027-02-18T10:00:00Z"),
      registeredBy: "gate-1",
    });
  });

  it("requires what it is, where it was found and where it is kept", async () => {
    const { useCase, created } = setup();
    await expect(
      useCase.execute(staff, {
        category: FoundItemCategory.KEYS,
        title: "",
        foundLocation: "Hall",
        storageLocation: "Portaria",
      }),
    ).rejects.toBeInstanceOf(AppException);
    expect(created).toHaveLength(0);
  });

  it("refuses a date in the future", async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute(staff, {
        category: FoundItemCategory.KEYS,
        title: "Chave",
        foundLocation: "Hall",
        storageLocation: "Portaria",
        foundAt: new Date("2026-11-21T10:00:00Z"),
      }),
    ).rejects.toBeInstanceOf(AppException);
  });
});

describe("ClaimFoundItemUseCase", () => {
  function setup(item: FoundItem, inserted: FoundItemClaim | null) {
    const told: string[][] = [];
    const items = {
      claim: async (
        _item: string,
        _user: string,
        _message: string,
        notices: (claim: FoundItemClaim) => OutboxDraft[],
      ) => {
        if (inserted) {
          told.push(
            notices(inserted).map(
              (notice) => (notice.payload as { userId: string }).userId,
            ),
          );
        }
        return inserted;
      },
    } as unknown as FoundItemRepositoryPort;
    return { useCase: new ClaimFoundItemUseCase(items, access(item)), told };
  }

  it("opens a claim and tells the staff", async () => {
    const { useCase, told } = setup(kept(), claim());
    await useCase.claim(
      resident,
      "item-1",
      "Chave do carro com chaveiro azul da Disney",
    );
    expect(told[0]).toEqual(["gate-1", "manager-1"]);
  });

  it("asks for a real description", async () => {
    const { useCase } = setup(kept(), claim());
    await expect(
      useCase.claim(resident, "item-1", "é meu"),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("refuses an item that already left", async () => {
    const { useCase } = setup(kept({ status: FoundItemStatus.RETURNED }), null);
    await expect(
      useCase.claim(resident, "item-1", "Chave do carro com chaveiro azul"),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("refuses a second open claim", async () => {
    const { useCase } = setup(kept(), null);
    await expect(
      useCase.claim(resident, "item-1", "Chave do carro com chaveiro azul"),
    ).rejects.toThrow("Você já pediu este item");
  });
});

describe("DecideClaimUseCase", () => {
  function setup(found: FoundItemClaim) {
    const decided: { status: ClaimStatus; note: string | null }[] = [];
    const items = {
      findClaim: async () => found,
      decideClaim: async (
        _id: string,
        decision: { status: ClaimStatus; note: string | null },
      ) => {
        decided.push(decision);
        return { ...found, ...decision };
      },
    } as unknown as FoundItemRepositoryPort;
    return {
      useCase: new DecideClaimUseCase(items, access(kept()), clock),
      decided,
    };
  }

  it("accepts without a note", async () => {
    const { useCase, decided } = setup(claim());
    await useCase.execute(staff, "claim-1", true, null);
    expect(decided[0]).toMatchObject({ status: ClaimStatus.ACCEPTED });
  });

  it("asks why when rejecting", async () => {
    const { useCase, decided } = setup(claim());
    await expect(
      useCase.execute(staff, "claim-1", false, ""),
    ).rejects.toBeInstanceOf(AppException);
    await useCase.execute(staff, "claim-1", false, "A cor não confere.");
    expect(decided[0]).toMatchObject({
      status: ClaimStatus.REJECTED,
      note: "A cor não confere.",
    });
  });
});

describe("ReturnFoundItemUseCase", () => {
  const DECLARATION = returnDeclaration({
    condominiumName: "Residencial Jardim",
    title: "Chave com chaveiro azul",
    category: FoundItemCategory.KEYS,
    foundLocation: "Salão de festas",
    foundOn: "19/11/2026",
  });
  const drawing = JSON.stringify({
    width: 600,
    height: 200,
    strokes: [
      Array.from({ length: 20 }, (_, index) => [
        40 + index * 20,
        80 + (index % 5) * 12,
        index * 30,
        0.5,
      ]),
    ],
  });

  function setup(found: FoundItemClaim | null) {
    let written: NewFoundItemReturn | null = null;
    const items = {
      findClaim: async () => found,
      returnItem: async (
        _id: string,
        record: NewFoundItemReturn,
        _note: string,
        notices: (item: FoundItem, rejected: FoundItemClaim[]) => OutboxDraft[],
      ) => {
        written = record;
        const item = kept({
          status: FoundItemStatus.RETURNED,
          returnedToId: record.claimantId,
          signerName: record.signerName,
          closedAt: now,
        });
        notices(item, [
          claim({
            id: "claim-2",
            userId: "resident-2",
            status: ClaimStatus.REJECTED,
          }),
        ]);
        return item;
      },
    } as unknown as FoundItemRepositoryPort;
    const declarations = {
      forItem: async () => DECLARATION,
    } as unknown as LostFoundDeclarationService;
    const images = {
      spacePhoto: async () => ({
        data: Buffer.from("webp"),
        contentType: "image/webp",
      }),
    } as unknown as ImageProcessorPort;
    const storage = {
      put: async () => undefined,
      deleteMany: async () => undefined,
    } as unknown as ObjectStoragePort;
    return {
      useCase: new ReturnFoundItemUseCase(
        items,
        access(kept()),
        declarations,
        images,
        storage,
        clock,
      ),
      written: () => written as NewFoundItemReturn | null,
    };
  }

  const input = {
    itemId: "item-1",
    signerName: "Maria Souza",
    declarationShown: DECLARATION,
    signatureImage: Buffer.from("png").toString("base64"),
    signatureDrawing: drawing,
    location: { status: LocationStatus.DENIED },
  };

  it("returns it to the accepted claim with the evidence digest", async () => {
    const { useCase, written } = setup(claim({ status: ClaimStatus.ACCEPTED }));
    const item = await useCase.execute(
      staff,
      { ...input, claimId: "claim-1" },
      { ipAddress: "200.1.2.3", userAgent: "Test" },
    );
    expect(item.status).toBe(FoundItemStatus.RETURNED);
    expect(written()).toMatchObject({
      claimId: "claim-1",
      claimantId: "resident-1",
      signerName: "Maria Souza",
      ipAddress: "200.1.2.3",
      collectedBy: "gate-1",
    });
    expect(written()?.declaration).toBe(`Eu, Maria Souza, ${DECLARATION}`);
    expect(written()?.evidenceSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a claim not accepted yet", async () => {
    const { useCase } = setup(claim());
    await expect(
      useCase.execute(
        staff,
        { ...input, claimId: "claim-1" },
        { ipAddress: null, userAgent: null },
      ),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("refuses a declaration that changed", async () => {
    const { useCase } = setup(null);
    await expect(
      useCase.execute(
        staff,
        { ...input, declarationShown: "outra" },
        { ipAddress: null, userAgent: null },
      ),
    ).rejects.toThrow("Os dados do item mudaram");
  });
});

describe("CloseFoundItemUseCase", () => {
  it("donates with a reason and tells the open claims", async () => {
    const told: string[] = [];
    const items = {
      close: async (
        _id: string,
        closing: { status: FoundItemStatus },
        note: string,
        notices: (item: FoundItem, rejected: FoundItemClaim[]) => OutboxDraft[],
      ) => {
        const drafts = notices(kept({ status: closing.status }), [
          claim({ status: ClaimStatus.REJECTED, decisionNote: note }),
        ]);
        drafts.forEach((draft) =>
          told.push((draft.payload as { userId: string }).userId),
        );
        return kept({ status: closing.status });
      },
    } as unknown as FoundItemRepositoryPort;
    const useCase = new CloseFoundItemUseCase(items, access(kept()), clock);
    await expect(
      useCase.execute(staff, "item-1", FoundItemStatus.DONATED, "x"),
    ).rejects.toBeInstanceOf(AppException);
    const item = await useCase.execute(
      staff,
      "item-1",
      FoundItemStatus.DONATED,
      "Prazo de guarda terminou.",
    );
    expect(item.status).toBe(FoundItemStatus.DONATED);
    expect(told).toEqual(["resident-1"]);
  });
});
