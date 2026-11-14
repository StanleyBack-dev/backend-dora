import { Injectable } from "@nestjs/common";
import sharp, { type Sharp } from "sharp";
import type {
  ImageProcessorPort,
  ProcessedImage,
} from "@/shared/application/ports/image-processor.port";
import { IMAGE_FORMATS, IMAGE_MAX_PIXELS } from "@/shared/domain/image-upload";
import {
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_SIZE,
} from "@/shared/domain/profile-photo";

const OPTIONS = {
  limitInputPixels: IMAGE_MAX_PIXELS,
  failOn: "warning" as const,
};

// Decoding and re-encoding with sharp (libvips): what gets stored is a new
// image made from the pixels only, so metadata, trailing data and anything
// hidden in the original file are gone.
@Injectable()
export class SharpImageProcessor implements ImageProcessorPort {
  profilePhoto(input: Buffer): Promise<ProcessedImage | null> {
    return this.reencode(input, PROFILE_PHOTO_MAX_BYTES, (image) =>
      image
        .resize(PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE, { fit: "cover" })
        .webp({ quality: 82 }),
    );
  }

  spacePhoto(
    input: Buffer,
    limits: { maxBytes: number; maxSide: number },
  ): Promise<ProcessedImage | null> {
    return this.reencode(input, limits.maxBytes, (image) =>
      image
        .resize(limits.maxSide, limits.maxSide, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 }),
    );
  }

  /** One still JPEG/PNG/WebP within the limits, rebuilt by `pipeline`. */
  private async reencode(
    input: Buffer,
    maxBytes: number,
    pipeline: (image: Sharp) => Sharp,
  ): Promise<ProcessedImage | null> {
    if (input.length === 0 || input.length > maxBytes) return null;
    try {
      const meta = await sharp(input, OPTIONS).metadata();
      if (
        !(IMAGE_FORMATS as readonly string[]).includes(meta.format ?? "") ||
        (meta.pages ?? 1) > 1
      ) {
        return null;
      }
      // rotate(): apply the EXIF orientation before the metadata is dropped.
      const data = await pipeline(sharp(input, OPTIONS).rotate()).toBuffer();
      return { data, contentType: "image/webp" };
    } catch {
      // Corrupt, truncated or too large to decode.
      return null;
    }
  }
}
