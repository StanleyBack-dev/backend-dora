import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { RequestMeta } from "@/common/decorators/request-meta.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { ParcelDeclarationService } from "@/modules/parcels/application/parcel-declaration.service";
import { pickedUpNotices } from "@/modules/parcels/application/parcel-notices";
import {
  PARCEL_REPOSITORY,
  type Parcel,
  type ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import { FindParcelByCodeUseCase } from "@/modules/parcels/application/use-cases/find-parcel-by-code.use-case";
import {
  canonicalJson,
  evidenceDigest,
  normalizeLocation,
  parseSignatureDrawing,
  sanitizeDevice,
  sha256,
  signedDeclaration,
  type LocationStatus,
  type SignatureEvidence,
} from "@/modules/parcels/domain/parcel-signature";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import {
  DocumentType,
  normalizeCpf,
  normalizeRg,
} from "@/shared/domain/identity-document";
import { decodeBase64Image } from "@/shared/domain/image-upload";

export type PickUpParcelInput = {
  /** The pickup code (typed, or read from the resident's QR). */
  code: string;
  signerName: string;
  signerDocumentType?: DocumentType | null;
  signerDocument?: string | null;
  /** The declaration as the signer saw it (must match the server's). */
  declarationShown: string;
  /** Base64 PNG/WebP of the drawn signature. */
  signatureImage: string;
  /** JSON: { width, height, strokes: [[x, y, t, pressure], …][] }. */
  signatureDrawing: string;
  clientSignedAt?: Date | null;
  clientTimeZone?: string | null;
  location: {
    status: LocationStatus;
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
  };
  device?: Record<string, unknown> | null;
};

/** Largest signature image (as sent) and the side it is shrunk to. */
export const SIGNATURE_IMAGE_MAX_BYTES = 400_000;
export const SIGNATURE_IMAGE_MAX_SIDE = 2000;

// The gate hands a parcel over: by its pickup code (the resident's QR, or
// typed), whoever picks it up signs on the gate's screen. The signature is
// stored with its evidence and a digest of it all (see parcel-signature),
// the parcel is closed and the unit's residents are told, in one
// transaction. Two staff members handing it over at once: only one wins.
@Injectable()
export class PickUpParcelUseCase {
  private readonly logger = new Logger(PickUpParcelUseCase.name);

  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
    private readonly finding: FindParcelByCodeUseCase,
    private readonly declarations: ParcelDeclarationService,
    private readonly access: ParcelAccessService,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: PickUpParcelInput,
    meta: RequestMeta,
  ): Promise<Parcel> {
    const parcel = await this.finding.waiting(actor, input.code);
    const signer = this.signer(input);
    const drawing = parseSignatureDrawing(input.signatureDrawing);
    if (!drawing) {
      throw AppException.from(APP_ERRORS.parcels.invalidSignature, undefined);
    }
    // The text signed is the one the server would show now: a parcel edited
    // meanwhile (or a forged text) is refused.
    const declaration = await this.declarations.forParcel(parcel);
    if (input.declarationShown.trim() !== declaration) {
      throw AppException.from(APP_ERRORS.parcels.notWaiting, {
        reason:
          "Os dados da encomenda mudaram enquanto a tela estava aberta. Busque o código de novo e peça para assinar outra vez.",
      });
    }
    const image = await this.signatureImage(input.signatureImage);
    const imageKey = `parcel-signatures/${parcel.condominiumId}/${parcel.id}/${randomUUID()}.webp`;
    await this.storage.put(imageKey, image.data, image.contentType);

    const evidence: SignatureEvidence = {
      parcelId: parcel.id,
      condominiumId: parcel.condominiumId,
      unitId: parcel.unitId,
      pickupCode: parcel.pickupCode,
      signerName: signer.name,
      signerDocumentType: signer.documentType,
      signerDocument: signer.document,
      declaration: signedDeclaration(signer.name, declaration),
      imageSha256: sha256(image.data),
      strokesSha256: sha256(canonicalJson(drawing)),
      signedAt: this.clock.now(),
      clientSignedAt: this.clientTime(input.clientSignedAt),
      clientTimeZone: input.clientTimeZone?.trim().slice(0, 64) || null,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? actor.ipAddress ?? null,
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
      device: sanitizeDevice(input.device),
      location: normalizeLocation(input.location),
      collectedBy: actor.id,
      collectedByName: actor.name,
      collectedByRole: actor.group,
      sessionId: actor.sessionId ?? null,
    };

    const residents = await this.access.audience(parcel);
    const picked = await this.parcels
      .pickUp(
        parcel.id,
        {
          ...evidence,
          imageKey,
          drawing,
          evidenceJson: canonicalJson(evidence),
          evidenceSha256: evidenceDigest(evidence),
        },
        (updated) => pickedUpNotices(updated, residents, this.clock.timeZone),
      )
      .catch(async (error: unknown) => {
        await this.discard(imageKey);
        throw error;
      });
    if (!picked) {
      await this.discard(imageKey);
      throw AppException.from(APP_ERRORS.parcels.notWaiting, {
        reason: "Esta encomenda já foi entregue, devolvida ou cancelada.",
      });
    }
    return picked;
  }

  private signer(input: PickUpParcelInput) {
    const name = input.signerName.trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 120) {
      throw AppException.from(APP_ERRORS.parcels.invalidSigner, {
        reason: "Informe o nome completo de quem está retirando.",
      });
    }
    const raw = input.signerDocument?.trim();
    if (!raw) return { name, documentType: null, document: null };
    const documentType = input.signerDocumentType ?? DocumentType.CPF;
    const document =
      documentType === DocumentType.CPF ? normalizeCpf(raw) : normalizeRg(raw);
    if (!document) {
      throw AppException.from(APP_ERRORS.parcels.invalidSigner, {
        reason:
          documentType === DocumentType.CPF
            ? "CPF inválido. Confira os números ou deixe em branco."
            : "RG inválido. Confira os números ou deixe em branco.",
      });
    }
    return { name, documentType, document };
  }

  private async signatureImage(base64: string) {
    const raw = decodeBase64Image(base64, SIGNATURE_IMAGE_MAX_BYTES);
    const image = raw
      ? await this.images.spacePhoto(raw, {
          maxBytes: SIGNATURE_IMAGE_MAX_BYTES,
          maxSide: SIGNATURE_IMAGE_MAX_SIDE,
        })
      : null;
    if (!image) {
      throw AppException.from(APP_ERRORS.parcels.invalidSignature, undefined);
    }
    return image;
  }

  /** The device's clock as it reported it; a date out of any reason is dropped. */
  private clientTime(value: Date | null | undefined): Date | null {
    if (!value || Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    return year >= 2000 && year <= 2100 ? value : null;
  }

  private async discard(key: string) {
    await this.storage.deleteMany([key]).catch((error) => {
      this.logger.warn(`Signature image not removed: ${String(error)}`);
    });
  }
}
