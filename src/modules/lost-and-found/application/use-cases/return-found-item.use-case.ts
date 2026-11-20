import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import type { RequestMeta } from "@/common/decorators/request-meta.decorator";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { LostFoundDeclarationService } from "@/modules/lost-and-found/application/lost-found-declaration.service";
import {
  decidedNotices,
  returnedNotices,
} from "@/modules/lost-and-found/application/lost-found-notices";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItem,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  ClaimStatus,
  isKept,
} from "@/modules/lost-and-found/domain/found-item";
import {
  type ReturnEvidence,
  returnEvidenceDigest,
} from "@/modules/lost-and-found/domain/return-evidence";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import type { DocumentType } from "@/shared/domain/identity-document";
import { decodeBase64Image } from "@/shared/domain/image-upload";
import {
  canonicalJson,
  type LocationStatus,
  normalizeLocation,
  parseSignatureDrawing,
  sanitizeDevice,
  sha256,
  signedDeclaration,
} from "@/shared/domain/signature/signature-capture";
import { normalizePerson } from "@/shared/domain/signature/signer";

export type ReturnFoundItemInput = {
  itemId: string;
  /** The accepted claim it closes (absent: handed over without one). */
  claimId?: string | null;
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
const SIGNATURE_IMAGE_MAX_BYTES = 400_000;
const SIGNATURE_IMAGE_MAX_SIDE = 2000;

const OTHERS_NOTE = "O item foi entregue a outra pessoa.";

// The staff hands a found item back: whoever takes it signs on the screen
// (the declaration they saw, the drawing, device, location…), the evidence
// and its digest are stored, the item is closed and every other open claim
// is rejected, in one transaction. With an accepted claim, that resident is
// told (with the receipt); two staff members at once: only one wins.
@Injectable()
export class ReturnFoundItemUseCase {
  private readonly logger = new Logger(ReturnFoundItemUseCase.name);

  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    private readonly access: LostFoundAccessService,
    private readonly declarations: LostFoundDeclarationService,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: ReturnFoundItemInput,
    meta: RequestMeta,
  ): Promise<FoundItem> {
    const item = await this.access.loadVisible(actor, input.itemId);
    if (!isKept(item.status)) {
      throw AppException.from(APP_ERRORS.lostFound.notKept, undefined);
    }
    const claim = await this.acceptedClaim(item, input.claimId);
    const signer = this.signer(input);
    const drawing = parseSignatureDrawing(input.signatureDrawing);
    if (!drawing) {
      throw AppException.from(APP_ERRORS.lostFound.invalidSignature, undefined);
    }
    // The text signed is the one the server would show now.
    const declaration = await this.declarations.forItem(item);
    if (input.declarationShown.trim() !== declaration) {
      throw AppException.from(
        APP_ERRORS.lostFound.declarationChanged,
        undefined,
      );
    }
    const image = await this.signatureImage(input.signatureImage);
    const imageKey = `found-item-returns/${item.condominiumId}/${item.id}/${randomUUID()}.webp`;
    await this.storage.put(imageKey, image.data, image.contentType);

    const evidence: ReturnEvidence = {
      itemId: item.id,
      condominiumId: item.condominiumId,
      claimId: claim?.id ?? null,
      claimantId: claim?.userId ?? null,
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

    const returned = await this.items
      .returnItem(
        item.id,
        {
          ...evidence,
          imageKey,
          drawing,
          evidenceJson: canonicalJson(evidence),
          evidenceSha256: returnEvidenceDigest(evidence),
        },
        OTHERS_NOTE,
        (updated, rejected) => [
          ...returnedNotices(updated, this.clock.timeZone),
          ...rejected.flatMap(decidedNotices),
        ],
      )
      .catch(async (error: unknown) => {
        await this.discard(imageKey);
        throw error;
      });
    if (!returned) {
      await this.discard(imageKey);
      throw AppException.from(APP_ERRORS.lostFound.notKept, undefined);
    }
    return returned;
  }

  /** The accepted claim being closed (absent: none). */
  private async acceptedClaim(item: FoundItem, claimId?: string | null) {
    if (!claimId) return null;
    const claim = await this.items.findClaim(item.condominiumId, claimId);
    if (!claim || claim.itemId !== item.id) {
      throw AppException.from(APP_ERRORS.lostFound.claimNotFound, undefined);
    }
    if (claim.status !== ClaimStatus.ACCEPTED) {
      throw AppException.from(APP_ERRORS.lostFound.invalid, {
        reason: "Aceite o pedido antes de entregar o item a quem pediu.",
      });
    }
    return claim;
  }

  private signer(input: ReturnFoundItemInput) {
    const checked = normalizePerson(
      {
        name: input.signerName,
        documentType: input.signerDocumentType,
        document: input.signerDocument,
      },
      "de quem está retirando",
    );
    if ("error" in checked) {
      throw AppException.from(APP_ERRORS.lostFound.invalidSigner, {
        reason: checked.error,
      });
    }
    return checked.person;
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
      throw AppException.from(APP_ERRORS.lostFound.invalidSignature, undefined);
    }
    return image;
  }

  /** The device's clock as it reported it; an implausible date is dropped. */
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
