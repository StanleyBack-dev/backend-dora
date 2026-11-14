import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SPACE_REPOSITORY,
  type SpaceRepositoryPort,
} from "@/modules/spaces/application/ports/space-repository.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// Removes a space created by mistake, with its photos. A space with bookings
// is deactivated instead, to keep its history.
@Injectable()
export class DeleteSpaceUseCase {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async execute(actor: AuthenticatedUser, id: string): Promise<void> {
    const space = await this.spaces.find(tenantOf(actor), id);
    if (!space) {
      throw AppException.from(APP_ERRORS.spaces.notFound, undefined);
    }
    if (await this.spaces.hasBookings(id)) {
      throw AppException.from(APP_ERRORS.spaces.hasBookings, undefined);
    }
    await this.spaces.delete(id);
    if (space.photos.length > 0) {
      // Best effort: the space is gone either way.
      await this.storage
        .deleteMany(space.photos.map((photo) => photo.key))
        .catch(() => {});
    }
  }
}
