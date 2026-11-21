import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import type { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import type { FoundItem } from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import type {
  LostReport,
  LostReportRepositoryPort,
  NewLostReport,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import type {
  ReturnReceiptDocument,
  ReturnReceiptRendererPort,
} from "@/modules/lost-and-found/application/ports/return-receipt-renderer.port";
import { GetReturnReceiptPdfUseCase } from "@/modules/lost-and-found/application/use-cases/get-return-receipt-pdf.use-case";
import type {
  CheckedReturn,
  GetReturnReceiptUseCase,
} from "@/modules/lost-and-found/application/use-cases/get-return-receipt.use-case";
import { ReportLostItemUseCase } from "@/modules/lost-and-found/application/use-cases/report-lost-item.use-case";
import {
  FoundItemCategory,
  FoundItemStatus,
} from "@/modules/lost-and-found/domain/found-item";
import { LostReportStatus } from "@/modules/lost-and-found/domain/lost-report";
import { PdfLibReturnReceiptRenderer } from "@/modules/lost-and-found/infrastructure/pdf/pdf-lib-return-receipt.renderer";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { ImageProcessorPort } from "@/shared/application/ports/image-processor.port";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";
import { DocumentType } from "@/shared/domain/identity-document";
import { LocationStatus } from "@/shared/domain/signature/signature-capture";
import type { ConfigService } from "@nestjs/config";

const now = new Date("2026-11-20T15:00:00Z");
const clock = { now: () => now, timeZone: "America/Sao_Paulo" } as ClockPort;
const resident = { id: "resident-1" } as AuthenticatedUser;
const access = {
  condominiumOf: async () => "condo-1",
} as unknown as LostFoundAccessService;

describe("ReportLostItemUseCase", () => {
  function setup(existing: Partial<LostReport> | null = null) {
    const created: NewLostReport[] = [];
    const closed: LostReportStatus[] = [];
    const reports = {
      create: async (report: NewLostReport) => {
        created.push(report);
        return { id: "report-1", ...report } as unknown as LostReport;
      },
      find: async () => existing,
      close: async (_id: string, _user: string, status: LostReportStatus) => {
        if (existing?.status !== LostReportStatus.OPEN) return null;
        closed.push(status);
        return { ...existing, status } as LostReport;
      },
    } as unknown as LostReportRepositoryPort;
    return {
      created,
      closed,
      useCase: new ReportLostItemUseCase(
        reports,
        access,
        {} as ImageProcessorPort,
        {} as ObjectStoragePort,
        clock,
      ),
    };
  }

  it("keeps what was lost, the optional texts tidied", async () => {
    const { useCase, created } = setup();
    await useCase.report(resident, {
      category: FoundItemCategory.KEYS,
      title: "  Chave   do carro ",
      description: "",
      lostLocation: "Garagem",
      lostOn: "2026-11-19",
    });
    expect(created[0]).toEqual({
      condominiumId: "condo-1",
      userId: "resident-1",
      category: FoundItemCategory.KEYS,
      title: "Chave do carro",
      description: null,
      lostLocation: "Garagem",
      lostOn: "2026-11-19",
      photoKey: null,
      shared: false,
    });
  });

  it("keeps a photo as WebP, and removes it when saving fails", async () => {
    const stored: string[] = [];
    const removed: string[] = [];
    const images = {
      spacePhoto: async () => ({
        data: Buffer.from("webp"),
        contentType: "image/webp",
      }),
    } as unknown as ImageProcessorPort;
    const storage = {
      put: async (key: string) => {
        stored.push(key);
      },
      deleteMany: async (keys: string[]) => {
        removed.push(...keys);
      },
    } as unknown as ObjectStoragePort;
    let fail = false;
    const reports = {
      create: async (report: NewLostReport) => {
        if (fail) throw new Error("db down");
        return { id: "report-1", ...report } as unknown as LostReport;
      },
    } as unknown as LostReportRepositoryPort;
    const useCase = new ReportLostItemUseCase(
      reports,
      access,
      images,
      storage,
      clock,
    );
    const input = {
      category: FoundItemCategory.KEYS,
      title: "Chave",
      photo: Buffer.from("png").toString("base64"),
    };
    const report = await useCase.report(resident, input);
    expect(report.photoKey).toMatch(/^lost-report-photos\/condo-1\/.+\.webp$/);

    fail = true;
    await expect(useCase.report(resident, input)).rejects.toThrow("db down");
    expect(removed).toEqual([stored[1]]);
  });

  it("refuses an empty title and a day in the future", async () => {
    const { useCase, created } = setup();
    await expect(
      useCase.report(resident, {
        category: FoundItemCategory.KEYS,
        title: "  ",
      }),
    ).rejects.toThrow("Diga o que perdeu");
    await expect(
      useCase.report(resident, {
        category: FoundItemCategory.KEYS,
        title: "Chave",
        lostOn: "2026-11-21",
      }),
    ).rejects.toThrow("futuro");
    expect(created).toHaveLength(0);
  });

  it("closes only the resident's own open report", async () => {
    const mine = setup({ userId: "resident-1", status: LostReportStatus.OPEN });
    await mine.useCase.close(resident, "report-1", true);
    expect(mine.closed).toEqual([LostReportStatus.FOUND]);

    const theirs = setup({
      userId: "resident-2",
      status: LostReportStatus.OPEN,
    });
    await expect(
      theirs.useCase.close(resident, "report-1", false),
    ).rejects.toThrow("não encontrado");

    const ended = setup({
      userId: "resident-1",
      status: LostReportStatus.CANCELLED,
    });
    await expect(
      ended.useCase.close(resident, "report-1", false),
    ).rejects.toThrow("já foi encerrado");
  });
});

const returnedItem = {
  id: "11111111-1111-4111-8111-111111111111",
  condominiumId: "condo-1",
  category: FoundItemCategory.CLOTHING,
  title: "Blusa vermelha — “tamanho M” ✓",
  description: "Com capuz",
  foundLocation: "Salão de festas",
  foundAt: new Date("2026-11-18T22:00:00Z"),
  storageLocation: "Portaria",
  status: FoundItemStatus.RETURNED,
  registeredByName: "João Porteiro",
  returnedToId: "resident-1",
  returnedToName: "Sônia Barbosa",
  createdAt: new Date("2026-11-18T22:10:00Z"),
} as FoundItem;

const signature = {
  itemId: returnedItem.id,
  claimId: "claim-1",
  signerName: "Sônia Barbosa",
  signerDocumentType: DocumentType.CPF,
  signerDocument: "12345678909",
  declaration: "Eu, Sônia Barbosa, declaro que recebi o item.",
  imageKey: "found-item-returns/x.png",
  imageSha256: "a".repeat(64),
  drawing: { width: 600, height: 200, strokes: [] },
  strokesSha256: "b".repeat(64),
  signedAt: new Date("2026-11-20T14:00:00Z"),
  clientSignedAt: null,
  clientTimeZone: null,
  ipAddress: "200.100.50.25",
  userAgent: "Test",
  device: {
    platform: "Android",
    pointerType: "touch",
    screenWidth: 390,
    screenHeight: 844,
    language: "pt-BR",
  },
  location: {
    status: LocationStatus.DENIED,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
  },
  collectedById: "gate-1",
  collectedByName: "João Porteiro",
  collectedByRole: "CONCIERGE",
  evidence: {},
  evidenceSha256: "c".repeat(64),
  intact: true,
  selfHandover: true,
} as unknown as CheckedReturn;

describe("PdfLibReturnReceiptRenderer", () => {
  it("renders a PDF, characters outside the font included", async () => {
    const pdf = await new PdfLibReturnReceiptRenderer().render({
      condominiumName: "Residencial Jardim das Flores",
      item: returnedItem,
      signature,
      signerDocumentMasked: "***.456.789-**",
      signaturePng: Buffer.from("not a png"),
      receiptUrl: `https://app.dora.com.br/achados-e-perdidos/${returnedItem.id}`,
      issuedAt: now,
      timeZone: "America/Sao_Paulo",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});

describe("GetReturnReceiptPdfUseCase", () => {
  function setup(item: FoundItem, seesReturn: boolean) {
    const rendered: ReturnReceiptDocument[] = [];
    const useCase = new GetReturnReceiptPdfUseCase(
      {
        loadVisible: async () => item,
        seesReturn: async () => seesReturn,
      } as unknown as LostFoundAccessService,
      { execute: async () => signature } as unknown as GetReturnReceiptUseCase,
      {
        find: async () => ({ name: "Residencial Jardim das Flores" }),
      } as unknown as CondominiumLookupService,
      {
        render: async (document: ReturnReceiptDocument) => {
          rendered.push(document);
          return Buffer.from("%PDF-1.7");
        },
      } as ReturnReceiptRendererPort,
      { get: async () => Buffer.from("png") } as unknown as ObjectStoragePort,
      clock,
      { get: () => "https://app.dora.com.br/" } as unknown as ConfigService,
    );
    return { useCase, rendered };
  }

  it("gives the receipt to whoever sees the return, document masked", async () => {
    const { useCase, rendered } = setup(returnedItem, true);
    const file = await useCase.execute(resident, returnedItem.id);
    expect(file).toMatchObject({
      fileName: "comprovante-devolucao-blusa-vermelha-tamanho-m.pdf",
      mimeType: "application/pdf",
    });
    expect(rendered[0]).toMatchObject({
      signerDocumentMasked: "***.456.789-**",
      receiptUrl: `https://app.dora.com.br/achados-e-perdidos/${returnedItem.id}`,
    });
  });

  it("refuses an item not returned, or a return the caller may not see", async () => {
    await expect(
      setup(
        { ...returnedItem, status: FoundItemStatus.FOUND },
        true,
      ).useCase.execute(resident, returnedItem.id),
    ).rejects.toThrow("não há comprovante");
    await expect(
      setup(returnedItem, false).useCase.execute(resident, returnedItem.id),
    ).rejects.toThrow("não há comprovante");
  });
});
