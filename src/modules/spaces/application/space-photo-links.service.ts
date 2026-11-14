import { Inject, Injectable } from "@nestjs/common";
import type { SpacePhoto } from "@/modules/spaces/domain/space-photo";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

/** A photo as people see it: a short-lived link, signed on each request. */
export type SpacePhotoLink = { id: string; url: string };

@Injectable()
export class SpacePhotoLinksService {
  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  links(photos: readonly SpacePhoto[]): Promise<SpacePhotoLink[]> {
    return Promise.all(
      photos.map(async (photo) => ({
        id: photo.id,
        url: await this.storage.signedReadUrl(photo.key),
      })),
    );
  }
}
