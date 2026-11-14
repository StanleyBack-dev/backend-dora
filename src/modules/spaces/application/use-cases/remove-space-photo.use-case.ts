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
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// Removes a photo from a space and deletes its file.
@Injectable()
export class RemoveSpacePhotoUseCase {
  private readonly logger = new Logger(RemoveSpacePhotoUseCase.name);

  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    spaceId: string,
    photoId: string,
  ): Promise<Space> {
    const space = await this.spaces.find(tenantOf(actor), spaceId);
    if (!space) {
      throw AppException.from(APP_ERRORS.spaces.notFound, undefined);
    }
    const photo = space.photos.find((item) => item.id === photoId);
    if (!photo) {
      throw AppException.from(APP_ERRORS.spaces.photoNotFound, undefined);
    }
    const updated = await this.spaces.update(space.id, {
      photos: space.photos.filter((item) => item.id !== photoId),
    });
    // The record no longer points to the file: a failed delete only leaves
    // an orphan file, never a broken photo.
    await this.storage
      .deleteMany([photo.key])
      .catch((error) =>
        this.logger.warn(`Space photo file not deleted: ${String(error)}`),
      );
    await this.audit.stamp({
      actorId: actor.id,
      entity: "space",
      entityId: space.id,
    });
    return updated;
  }
}
