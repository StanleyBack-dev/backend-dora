// Photos of a space (shown to residents in the catalog and when booking).

export type SpacePhoto = {
  /** Random id, also the file name in the object storage. */
  id: string;
  key: string;
};

/** Photos per space. */
export const SPACE_PHOTO_LIMIT = 3;

/**
 * Largest file accepted. The browser shrinks the photo to 1600 px before
 * sending it, which leaves it far below this.
 */
export const SPACE_PHOTO_MAX_BYTES = 1_200_000;

/** Longest side of the stored image. */
export const SPACE_PHOTO_MAX_SIDE = 1600;

/** Where a space photo is stored (random name, never user input). */
export const spacePhotoKey = (
  condominiumId: string,
  spaceId: string,
  photoId: string,
) => `space-photos/${condominiumId}/${spaceId}/${photoId}.webp`;
