import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { reservedNotices } from "@/modules/lost-and-found/application/lost-found-notices";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItem,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  FOUND_ITEM_KEEP_DAYS,
  FOUND_ITEM_REQUIRED_FIELDS,
  FOUND_ITEM_TEXT_LIMITS,
  type FoundItemCategory,
  type FoundItemTextField,
  hidesPhotoByDefault,
  optionalText,
} from "@/modules/lost-and-found/domain/found-item";
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

export type RegisterFoundItemInput = {
  category: FoundItemCategory;
  title: string;
  description?: string | null;
  privateDetails?: string | null;
  /** Whose the desk knows it is: a unit (its residents are told)… */
  ownerUnitId?: string | null;
  /** …or one of its residents (only them, with an accepted claim). */
  ownerUserId?: string | null;
  foundLocation: string;
  /** When it was found (default: now; never in the future). */
  foundAt?: Date | null;
  storageLocation: string;
  /** Base64 JPEG/PNG/WebP (no data: prefix). */
  photo?: string | null;
  /** Hide the photo from residents (default: only for documents). */
  photoHidden?: boolean | null;
};

/** Largest photo (as sent) and the side it is shrunk to. */
export const FOUND_ITEM_PHOTO_MAX_BYTES = 1_000_000;
export const FOUND_ITEM_PHOTO_MAX_SIDE = 1600;

const DAY_MS = 86_400_000;

const LABELS: Record<FoundItemTextField, string> = {
  title: "O que é",
  description: "A descrição",
  privateDetails: "Os detalhes para conferir",
  foundLocation: "O local onde foi achado",
  storageLocation: "O local onde ficou guardado",
};

const REQUIRED: Partial<Record<FoundItemTextField, string>> = {
  title: "Diga o que é o item (ex.: chave com chaveiro azul).",
  foundLocation: "Informe onde o item foi achado.",
  storageLocation: "Informe onde o item ficou guardado.",
};

// The gate or the administration registers something found in the
// condominium: what it is, where and when it was found, where it is kept,
// details only the staff sees (to check the owner) and, optionally, a photo
// (re-encoded from its pixels, no metadata). It is kept for
// FOUND_ITEM_KEEP_DAYS days from when it was found. When the desk knows
// whose it is (a unit, or one of its residents, like a parcel), only they
// are told and see it.
@Injectable()
export class RegisterFoundItemUseCase {
  private readonly logger = new Logger(RegisterFoundItemUseCase.name);

  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    private readonly access: LostFoundAccessService,
    private readonly condominiums: CondominiumLookupService,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: RegisterFoundItemInput,
  ): Promise<FoundItem> {
    const condominiumId = await this.access.condominiumOf(actor);
    const texts = this.texts(input);
    const now = this.clock.now();
    const foundAt = input.foundAt ?? now;
    if (Number.isNaN(foundAt.getTime()) || foundAt > now) {
      throw AppException.from(APP_ERRORS.lostFound.invalid, {
        reason: "A data em que foi achado não pode estar no futuro.",
      });
    }

    const owner = await this.owner(condominiumId, input);

    const photoKey = input.photo
      ? await this.storePhoto(condominiumId, input.photo)
      : null;
    try {
      const audience = owner.unitId
        ? await this.access.ownerAudience({
            condominiumId,
            ownerUnitId: owner.unitId,
            ownerUserId: owner.userId,
          })
        : [];
      return await this.items.create(
        {
          condominiumId,
          category: input.category,
          title: texts.title as string,
          description: texts.description,
          privateDetails: texts.privateDetails,
          foundLocation: texts.foundLocation as string,
          foundAt,
          storageLocation: texts.storageLocation as string,
          photoKey,
          photoHidden: input.photoHidden ?? hidesPhotoByDefault(input.category),
          keepUntil: new Date(
            foundAt.getTime() + FOUND_ITEM_KEEP_DAYS * DAY_MS,
          ),
          registeredBy: actor.id,
          ownerUnitId: owner.unitId,
          ownerUserId: owner.userId,
        },
        (created) => reservedNotices(created, audience, this.clock.timeZone),
      );
    } catch (error) {
      if (photoKey) {
        await this.storage.deleteMany([photoKey]).catch((cause) => {
          this.logger.warn(`Found item photo not removed: ${String(cause)}`);
        });
      }
      throw error;
    }
  }

  /** The unit (and resident) named, checked to belong together there. */
  private async owner(
    condominiumId: string,
    input: RegisterFoundItemInput,
  ): Promise<{ unitId: string | null; userId: string | null }> {
    const unitId = input.ownerUnitId?.trim() || null;
    const userId = input.ownerUserId?.trim() || null;
    if (!unitId) {
      if (userId) {
        throw AppException.from(APP_ERRORS.lostFound.invalid, {
          reason: "Escolha a unidade do morador.",
        });
      }
      return { unitId: null, userId: null };
    }
    const unit = await this.condominiums.unitIn(condominiumId, unitId);
    if (!unit) {
      throw AppException.from(APP_ERRORS.lostFound.invalid, {
        reason: "A unidade escolhida não é deste condomínio.",
      });
    }
    if (userId) {
      const residents = await this.access.ownerAudience({
        condominiumId,
        ownerUnitId: unit.id,
        ownerUserId: null,
      });
      if (!residents.includes(userId)) {
        throw AppException.from(APP_ERRORS.lostFound.invalid, {
          reason: "O morador escolhido não mora nesta unidade.",
        });
      }
    }
    return { unitId: unit.id, userId };
  }

  private texts(input: RegisterFoundItemInput) {
    const result = {} as Record<FoundItemTextField, string | null>;
    for (const field of Object.keys(
      FOUND_ITEM_TEXT_LIMITS,
    ) as FoundItemTextField[]) {
      const value = optionalText(input[field], FOUND_ITEM_TEXT_LIMITS[field]);
      if (value === undefined) {
        throw AppException.from(APP_ERRORS.lostFound.invalid, {
          reason: `${LABELS[field]} pode ter até ${FOUND_ITEM_TEXT_LIMITS[field]} caracteres.`,
        });
      }
      if (value === null && FOUND_ITEM_REQUIRED_FIELDS.includes(field)) {
        throw AppException.from(APP_ERRORS.lostFound.invalid, {
          reason: REQUIRED[field] ?? `${LABELS[field]} é obrigatório.`,
        });
      }
      result[field] = value;
    }
    return result;
  }

  private async storePhoto(condominiumId: string, base64: string) {
    const raw = decodeBase64Image(base64, FOUND_ITEM_PHOTO_MAX_BYTES);
    const image = raw
      ? await this.images.spacePhoto(raw, {
          maxBytes: FOUND_ITEM_PHOTO_MAX_BYTES,
          maxSide: FOUND_ITEM_PHOTO_MAX_SIDE,
        })
      : null;
    if (!image) {
      throw AppException.from(APP_ERRORS.lostFound.invalidPhoto, undefined);
    }
    const key = `found-item-photos/${condominiumId}/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    return key;
  }
}
