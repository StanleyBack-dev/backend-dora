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
  PARCEL_REQUIRED_FIELDS,
  parcelCode,
  PERISHABLE_DEADLINE_HOURS,
  PERISHABLE_DEFAULT_DEADLINE_HOURS,
  perishableDeadline,
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
  /**
   * Chosen by name: only this resident (of that unit) is told and sees it
   * (a surprise, a gift). Absent: every resident of the unit.
   */
  recipientUserId?: string | null;
  /** Required. */
  carrier?: string | null;
  trackingCode?: string | null;
  notes?: string | null;
  /** Required. */
  storageLocation?: string | null;
  /** Base64 JPEG/PNG/WebP (no data: prefix). */
  photo?: string | null;
  /** Food, medicine, flowers…: picked up by a deadline. */
  perishable?: boolean | null;
  /** Hours until the deadline (PERISHABLE_DEADLINE_HOURS; default 4). */
  perishableHours?: number | null;
};

/** Largest photo (as sent) and the side it is shrunk to. */
export const PARCEL_PHOTO_MAX_BYTES = 1_000_000;
export const PARCEL_PHOTO_MAX_SIDE = 1600;

const REQUIRED_MESSAGES: Partial<Record<ParcelTextField, string>> = {
  carrier: "Informe a transportadora ou loja.",
  storageLocation: "Informe onde a encomenda ficou guardada.",
};

const LABELS: Record<ParcelTextField, string> = {
  recipientName: "O destinatário",
  carrier: "A transportadora ou loja",
  trackingCode: "O código de rastreio",
  notes: "A observação",
  storageLocation: "O local onde ficou guardada",
};

// The gate registers a parcel for a unit (the carrier and where it is kept
// are required), optionally with a photo (re-encoded from its pixels, no
// metadata). It gets a pickup code, and the unit's residents (or only
// the resident it was registered for by name) are told in the same
// transaction.
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

    const residents = await this.users.activeUnitMemberIds(
      condominiumId,
      unit.id,
    );
    const recipientUserId = input.recipientUserId?.trim() || null;
    if (recipientUserId && !residents.includes(recipientUserId)) {
      throw AppException.from(APP_ERRORS.parcels.invalid, {
        reason: "O morador escolhido não mora nesta unidade.",
      });
    }
    const audience = recipientUserId ? [recipientUserId] : residents;

    const receivedAt = this.clock.now();
    let pickupDeadline: Date | null = null;
    if (input.perishable) {
      pickupDeadline = perishableDeadline(
        receivedAt,
        input.perishableHours ?? PERISHABLE_DEFAULT_DEADLINE_HOURS,
      );
      if (!pickupDeadline) {
        throw AppException.from(APP_ERRORS.parcels.invalid, {
          reason: `Escolha o prazo de retirada da encomenda perecível (${PERISHABLE_DEADLINE_HOURS.join(", ")} horas).`,
        });
      }
    }

    const photoKey = input.photo
      ? await this.storePhoto(condominiumId, input.photo)
      : null;
    try {
      return await this.parcels.create(
        {
          condominiumId,
          unitId: unit.id,
          ...texts,
          recipientUserId,
          photoKey,
          pickupCode: await this.freeCode(),
          receivedAt,
          receivedBy: actor.id,
          pickupDeadline,
        },
        (parcel) => receivedNotices(parcel, audience, this.clock.timeZone),
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
      if (value === null && PARCEL_REQUIRED_FIELDS.includes(field)) {
        throw AppException.from(APP_ERRORS.parcels.invalid, {
          reason: REQUIRED_MESSAGES[field] ?? `${LABELS[field]} é obrigatório.`,
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
