import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  SPACE_REPOSITORY,
  type SpaceRepositoryPort,
} from "@/modules/spaces/application/ports/space-repository.port";
import type { Space } from "@/modules/spaces/domain/space";
import {
  SPACE_PHOTO_LIMIT,
  SPACE_PHOTO_MAX_BYTES,
  SPACE_PHOTO_MAX_SIDE,
  spacePhotoKey,
} from "@/modules/spaces/domain/space-photo";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { decodeBase64Image } from "@/shared/domain/image-upload";

// Adds a photo to a space. The file is checked by its content (JPEG, PNG or
// WebP, size and pixel limits) and stored as a new WebP made from the pixels
// only (no EXIF/GPS, nothing hidden in the original).
@Injectable()
export class AddSpacePhotoUseCase {
  private readonly logger = new Logger(AddSpacePhotoUseCase.name);

  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    spaceId: string,
    photo: string,
  ): Promise<Space> {
    const condominiumId = tenantOf(actor);
    const space = await this.spaces.find(condominiumId, spaceId);
    if (!space) {
      throw AppException.from(APP_ERRORS.spaces.notFound, undefined);
    }
    if (space.photos.length >= SPACE_PHOTO_LIMIT) {
      throw AppException.from(APP_ERRORS.spaces.photoLimit, undefined);
    }

    const raw = decodeBase64Image(photo, SPACE_PHOTO_MAX_BYTES);
    const image = raw
      ? await this.images.spacePhoto(raw, {
          maxBytes: SPACE_PHOTO_MAX_BYTES,
          maxSide: SPACE_PHOTO_MAX_SIDE,
        })
      : null;
    if (!image) {
      throw AppException.from(APP_ERRORS.spaces.invalidPhoto, undefined);
    }

    const id = randomUUID();
    const key = spacePhotoKey(condominiumId, space.id, id);
    await this.storage.put(key, image.data, image.contentType);
    let updated: Space;
    try {
      // The database also caps the list at 3 (two uploads at once).
      updated = await this.spaces.update(space.id, {
        photos: [...space.photos, { id, key }],
      });
    } catch (error) {
      await this.storage.deleteMany([key]).catch(() => {});
      this.logger.warn(`Space photo not saved: ${String(error)}`);
      throw AppException.from(APP_ERRORS.spaces.photoLimit, undefined);
    }
    await this.audit.stamp({
      actorId: actor.id,
      entity: "space",
      entityId: space.id,
    });
    return updated;
  }
}
