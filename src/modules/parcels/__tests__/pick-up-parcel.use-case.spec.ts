import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AppException } from "@/common/exceptions/app-exception";
import type { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import type { ParcelDeclarationService } from "@/modules/parcels/application/parcel-declaration.service";
import type {
  NewParcelSignature,
  Parcel,
  ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import type { FindParcelByCodeUseCase } from "@/modules/parcels/application/use-cases/find-parcel-by-code.use-case";
import {
  PickUpParcelUseCase,
  type PickUpParcelInput,
} from "@/modules/parcels/application/use-cases/pick-up-parcel.use-case";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import {
  canonicalJson,
  LocationStatus,
  sha256,
} from "@/modules/parcels/domain/parcel-signature";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type { ImageProcessorPort } from "@/shared/application/ports/image-processor.port";
import type { ObjectStoragePort } from "@/shared/application/ports/object-storage.port";
import { DocumentType } from "@/shared/domain/identity-document";

const NOW = new Date("2026-11-20T15:00:00Z");
const DECLARATION = "declaro que recebi a encomenda ABC234.";

const actor = {
  id: "staff-1",
  name: "Porteiro Zé",
  sessionId: "session-1",
  group: "ADMIN",
  ipAddress: null,
} as AuthenticatedUser;

const parcel: Parcel = {
  id: "parcel-1",
  condominiumId: "condo-1",
  unitId: "unit-1",
  unitLabel: "A · 101",
  recipientName: null,
  recipientUserId: null,
  carrier: null,
  trackingCode: null,
  notes: null,
  storageLocation: null,
  photoKey: null,
  pickupCode: "ABC234",
  status: ParcelStatus.RECEIVED,
  receivedAt: NOW,
  receivedById: "staff-1",
  receivedByName: "Porteiro Zé",
  closedAt: null,
  closedById: null,
  closedByName: null,
  closeReason: null,
  remindedAt: null,
  signerName: null,
};

const input = (
  overrides: Partial<PickUpParcelInput> = {},
): PickUpParcelInput => ({
  code: "abc-234",
  signerName: "  Maria   Souza ",
  signerDocumentType: DocumentType.CPF,
  signerDocument: "529.982.247-25",
  declarationShown: DECLARATION,
  signatureImage: Buffer.from("png").toString("base64"),
  signatureDrawing: JSON.stringify({
    width: 600,
    height: 200,
    strokes: [
      Array.from({ length: 20 }, (_, i) => [
        10 + i * 25,
        i % 2 ? 30 : 170,
        i * 20,
        0.4,
      ]),
    ],
  }),
  location: {
    status: LocationStatus.GRANTED,
    latitude: -23.55,
    longitude: -46.63,
    accuracyMeters: 10,
  },
  device: { pointerType: "touch", platform: "Android" },
  ...overrides,
});

function setup(pickUpResult: "ok" | "taken" = "ok") {
  const stored: string[] = [];
  const deleted: string[] = [];
  let written: NewParcelSignature | null = null;
  const parcels = {
    pickUp: async (_id: string, signature: NewParcelSignature) => {
      written = signature;
      return pickUpResult === "ok"
        ? {
            ...parcel,
            status: ParcelStatus.PICKED_UP,
            signerName: signature.signerName,
          }
        : null;
    },
  } as unknown as ParcelRepositoryPort;
  const finding = {
    waiting: async () => parcel,
  } as unknown as FindParcelByCodeUseCase;
  const declarations = {
    forParcel: async () => DECLARATION,
  } as unknown as ParcelDeclarationService;
  const access = {
    audience: async () => ["resident-1"],
  } as unknown as ParcelAccessService;
  const images = {
    spacePhoto: async (raw: Buffer) =>
      raw.toString() === "png"
        ? { data: Buffer.from("webp"), contentType: "image/webp" }
        : null,
  } as unknown as ImageProcessorPort;
  const storage = {
    put: async (key: string) => {
      stored.push(key);
    },
    deleteMany: async (keys: string[]) => {
      deleted.push(...keys);
    },
  } as unknown as ObjectStoragePort;
  const clock = { now: () => NOW, timeZone: "America/Sao_Paulo" } as ClockPort;
  return {
    useCase: new PickUpParcelUseCase(
      parcels,
      finding,
      declarations,
      access,
      images,
      storage,
      clock,
    ),
    stored,
    deleted,
    written: () => written as NewParcelSignature | null,
  };
}

const meta = { ipAddress: "200.10.20.30", userAgent: "Mozilla/5.0 Tablet" };

describe("PickUpParcelUseCase", () => {
  it("stores the signature with its evidence and a digest of it", async () => {
    const { useCase, stored, written } = setup();
    const result = await useCase.execute(actor, input(), meta);

    expect(result.status).toBe(ParcelStatus.PICKED_UP);
    expect(stored).toHaveLength(1);
    const signature = written();
    expect(signature).toMatchObject({
      signerName: "Maria Souza",
      signerDocument: "52998224725",
      declaration: `Eu, Maria Souza, ${DECLARATION}`,
      imageSha256: sha256(Buffer.from("webp")),
      signedAt: NOW,
      ipAddress: "200.10.20.30",
      userAgent: "Mozilla/5.0 Tablet",
      collectedBy: "staff-1",
      collectedByName: "Porteiro Zé",
      sessionId: "session-1",
      collectedByRole: "ADMIN",
      device: { pointerType: "touch", platform: "Android" },
    });
    expect(signature?.location.status).toBe(LocationStatus.GRANTED);
    expect(signature?.strokesSha256).toBe(
      sha256(canonicalJson(signature?.drawing)),
    );
    // What is digested is exactly what is stored.
    expect(signature?.evidenceSha256).toBe(
      sha256(signature?.evidenceJson ?? ""),
    );
  });

  it("refuses a declaration different from the one the server shows", async () => {
    const { useCase, stored } = setup();
    await expect(
      useCase.execute(actor, input({ declarationShown: "outro texto" }), meta),
    ).rejects.toBeInstanceOf(AppException);
    expect(stored).toHaveLength(0);
  });

  it("refuses an invalid CPF and a drawing that is not a signature", async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute(actor, input({ signerDocument: "111.111.111-11" }), meta),
    ).rejects.toBeInstanceOf(AppException);
    await expect(
      useCase.execute(actor, input({ signatureDrawing: "[]" }), meta),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("removes the stored image when someone else handed it over first", async () => {
    const { useCase, stored, deleted } = setup("taken");
    await expect(useCase.execute(actor, input(), meta)).rejects.toBeInstanceOf(
      AppException,
    );
    expect(deleted).toEqual(stored);
  });
});
