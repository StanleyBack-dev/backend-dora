// Server-side handling of images sent by people (profile and space photos).

export type ProcessedImage = { data: Buffer; contentType: string };

export interface ImageProcessorPort {
  /**
   * Checks the file by its content (not its name or declared type) and
   * re-encodes it as a square WebP without metadata (EXIF, GPS). Null when
   * it is not a single JPEG, PNG or WebP image within the limits.
   */
  profilePhoto(input: Buffer): Promise<ProcessedImage | null>;
  /**
   * Same checks; re-encodes it as a WebP that fits in `maxSide` (keeping
   * its proportions, never enlarged), without metadata.
   */
  spacePhoto(
    input: Buffer,
    limits: { maxBytes: number; maxSide: number },
  ): Promise<ProcessedImage | null>;
}

export const IMAGE_PROCESSOR = Symbol("IMAGE_PROCESSOR");
