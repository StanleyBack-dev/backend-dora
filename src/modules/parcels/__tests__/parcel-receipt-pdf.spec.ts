import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AppException } from "@/common/exceptions/app-exception";
import type { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import type { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import type {
  ParcelReceiptDocument,
  ParcelReceiptRendererPort,
} from "@/modules/parcels/application/ports/parcel-receipt-renderer.port";
import type { Parcel } from "@/modules/parcels/application/ports/parcel-repository.port";
import { GetParcelReceiptPdfUseCase } from "@/modules/parcels/application/use-cases/get-parcel-receipt-pdf.use-case";
import type {
  CheckedSignature,
  GetParcelSignatureUseCase,
} from "@/modules/parcels/application/use-cases/get-parcel-signature.use-case";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import { LocationStatus } from "@/modules/parcels/domain/parcel-signature";
import { PdfLibParcelReceiptRenderer } from "@/modules/parcels/infrastructure/pdf/pdf-lib-parcel-receipt.renderer";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";
import { DocumentType } from "@/shared/domain/identity-document";
import type { ConfigService } from "@nestjs/config";

const actor = { id: "resident-1" } as AuthenticatedUser;

const sampleParcel = {
  id: "11111111-1111-4111-8111-111111111111",
  condominiumId: "condo-1",
  unitId: "unit-1",
  unitLabel: "Bloco A · 101",
  recipientName: "Maria da Conceição",
  carrier: "Mercado Livre",
  trackingCode: "BR123456789",
  pickupCode: "ABC234",
  status: ParcelStatus.PICKED_UP,
  receivedAt: new Date("2026-11-19T13:00:00Z"),
  receivedByName: "João Porteiro",
  perishable: true,
  pickupDeadline: new Date("2026-11-19T17:00:00Z"),
} as Parcel;

const sampleSignature = {
  parcelId: sampleParcel.id,
  signerName: "Maria da Conceição",
  signerDocumentType: DocumentType.CPF,
  signerDocument: "12345678909",
  declaration:
    "Eu, Maria da Conceição, declaro que recebi do Residencial Jardim das Flores a encomenda de código ABC 234 (Mercado Livre · para Maria da Conceição), em perfeito estado — “sem avarias” ✓.",
  imageKey: "parcel-signatures/x.png",
  imageSha256: "a".repeat(64),
  drawing: { width: 600, height: 200, strokes: [] },
  strokesSha256: "b".repeat(64),
  signedAt: new Date("2026-11-19T15:30:00Z"),
  clientSignedAt: new Date("2026-11-19T15:30:01Z"),
  clientTimeZone: "America/Sao_Paulo",
  ipAddress: "200.100.50.25",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  device: {
    platform: "iPhone",
    pointerType: "touch",
    screenWidth: 390,
    screenHeight: 844,
    language: "pt-BR",
  },
  location: {
    status: LocationStatus.GRANTED,
    latitude: -23.55052,
    longitude: -46.633308,
    accuracyMeters: 12.4,
  },
  collectedById: "staff-1",
  collectedByName: "João Porteiro",
  collectedByRole: "CONCIERGE",
  sessionId: null,
  evidence: {},
  evidenceSha256: "c".repeat(64),
  intact: true,
} as unknown as CheckedSignature;

const sampleDocument = (
  overrides: Partial<ParcelReceiptDocument> = {},
): ParcelReceiptDocument => ({
  condominiumName: "Residencial Jardim das Flores",
  parcel: sampleParcel,
  signature: sampleSignature,
  signerDocumentMasked: "***.456.789-**",
  signaturePng: null,
  receiptUrl: `https://app.dora.com.br/encomendas/${sampleParcel.id}`,
  issuedAt: new Date("2026-11-20T12:00:00Z"),
  timeZone: "America/Sao_Paulo",
  ...overrides,
});

describe("PdfLibParcelReceiptRenderer", () => {
  it("renders a PDF, characters outside the font included", async () => {
    const pdf = await new PdfLibParcelReceiptRenderer().render(
      sampleDocument(),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("renders an altered record and a missing image", async () => {
    const pdf = await new PdfLibParcelReceiptRenderer().render(
      sampleDocument({
        signature: { ...sampleSignature, intact: false },
        signaturePng: Buffer.from("not a png"),
      }),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("GetParcelReceiptPdfUseCase", () => {
  function setup(parcel: Parcel, signature: CheckedSignature | null) {
    const rendered: ParcelReceiptDocument[] = [];
    const useCase = new GetParcelReceiptPdfUseCase(
      { loadVisible: async () => parcel } as unknown as ParcelAccessService,
      {
        execute: async () => signature,
      } as unknown as GetParcelSignatureUseCase,
      {
        find: async () => ({ name: "Residencial Jardim das Flores" }),
      } as unknown as CondominiumLookupService,
      {
        render: async (document: ParcelReceiptDocument) => {
          rendered.push(document);
          return Buffer.from("%PDF-1.7");
        },
      } as ParcelReceiptRendererPort,
      { get: async () => Buffer.from("png") } as unknown as ObjectStoragePort,
      {
        now: () => new Date("2026-11-20T12:00:00Z"),
        timeZone: "America/Sao_Paulo",
      } as ClockPort,
      { get: () => "https://app.dora.com.br/" } as unknown as ConfigService,
    );
    return { useCase, rendered };
  }

  it("returns the receipt with the masked document and the app link", async () => {
    const { useCase, rendered } = setup(sampleParcel, sampleSignature);
    const file = await useCase.execute(actor, sampleParcel.id);
    expect(file).toMatchObject({
      fileName: "comprovante-encomenda-ABC234.pdf",
      mimeType: "application/pdf",
    });
    expect(Buffer.from(file.base64Content, "base64").toString()).toBe(
      "%PDF-1.7",
    );
    expect(rendered[0].signerDocumentMasked).toBe("***.456.789-**");
    expect(rendered[0].receiptUrl).toBe(
      `https://app.dora.com.br/encomendas/${sampleParcel.id}`,
    );
  });

  it("refuses a parcel not picked up", async () => {
    const { useCase } = setup(
      { ...sampleParcel, status: ParcelStatus.RECEIVED },
      null,
    );
    await expect(
      useCase.execute(actor, sampleParcel.id),
    ).rejects.toBeInstanceOf(AppException);
  });
});
