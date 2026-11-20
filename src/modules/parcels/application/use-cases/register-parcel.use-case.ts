import { randomInt, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { receivedNotices } from "@/modules/parcels/application/parcel-notices";
import {
  PARCEL_REPOSITORY,
  type Parcel,
  type ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import {
  optionalText,
  PARCEL_TEXT_LIMITS,
  parcelCode,
  type ParcelTextField,
} from "@/modules/parcels/domain/parcel";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { decodeBase64Image } from "@/shared/domain/image-upload";

export type RegisterParcelInput = {
  unitId: string;
  recipientName?: string | null;
  carrier?: string | null;
  trackingCode?: string | null;
  notes?: string | null;
  storageLocation?: string | null;
  /** Base64 JPEG/PNG/WebP (no data: prefix). */
  photo?: string | null;
};

/** Largest photo (as sent) and the side it is shrunk to. */
export const PARCEL_PHOTO_MAX_BYTES = 1_000_000;
export const PARCEL_PHOTO_MAX_SIDE = 1600;

const LABELS: Record<ParcelTextField, string> = {
  recipientName: "O destinatário",
  carrier: "A transportadora",
  trackingCode: "O código de rastreio",
  notes: "A observação",
  storageLocation: "O local onde ficou guardada",
};

// The gate registers a parcel for a unit, optionally with a photo (re-encoded
// from its pixels, no metadata). It gets a pickup code, and the unit's
// residents are told in the same transaction.
@Injectable()
export class RegisterParcelUseCase {
  private readonly logger = new Logger(RegisterParcelUseCase.name);

  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
    private readonly access: ParcelAccessService,
    private readonly condominiums: CondominiumLookupService,
    private readonly users: UserLookupService,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: RegisterParcelInput,
  ): Promise<Parcel> {
    const condominiumId = await this.access.condominiumOf(actor);
    const unit = await this.condominiums.unitIn(condominiumId, input.unitId);
    if (!unit) {
      throw AppException.from(APP_ERRORS.parcels.unitNotFound, undefined);
    }
    const texts = this.texts(input);

    const photoKey = input.photo
      ? await this.storePhoto(condominiumId, input.photo)
      : null;
    const residents = await this.users.activeUnitMemberIds(
      condominiumId,
      unit.id,
    );
    try {
      return await this.parcels.create(
        {
          condominiumId,
          unitId: unit.id,
          ...texts,
          photoKey,
          pickupCode: await this.freeCode(),
          receivedAt: this.clock.now(),
          receivedBy: actor.id,
        },
        (parcel) => receivedNotices(parcel, residents, this.clock.timeZone),
      );
    } catch (error) {
      if (photoKey) {
        await this.storage.deleteMany([photoKey]).catch((cause) => {
          this.logger.warn(`Parcel photo not removed: ${String(cause)}`);
        });
      }
      throw error;
    }
  }

  private texts(input: RegisterParcelInput) {
    const result = {} as Record<ParcelTextField, string | null>;
    for (const field of Object.keys(PARCEL_TEXT_LIMITS) as ParcelTextField[]) {
      const value = optionalText(input[field], PARCEL_TEXT_LIMITS[field]);
      if (value === undefined) {
        throw AppException.from(APP_ERRORS.parcels.invalid, {
          reason: `${LABELS[field]} pode ter até ${PARCEL_TEXT_LIMITS[field]} caracteres.`,
        });
      }
      result[field] = value;
    }
    return result;
  }

  private async storePhoto(condominiumId: string, base64: string) {
    const raw = decodeBase64Image(base64, PARCEL_PHOTO_MAX_BYTES);
    const image = raw
      ? await this.images.spacePhoto(raw, {
          maxBytes: PARCEL_PHOTO_MAX_BYTES,
          maxSide: PARCEL_PHOTO_MAX_SIDE,
        })
      : null;
    if (!image) {
      throw AppException.from(APP_ERRORS.parcels.invalidPhoto, undefined);
    }
    const key = `parcel-photos/${condominiumId}/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    return key;
  }

  /** A code no parcel uses (collisions are rare: 31^6 codes). */
  private async freeCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = parcelCode(randomInt);
      if (!(await this.parcels.findByCode(code))) return code;
    }
    throw new Error("No free parcel code");
  }
}
