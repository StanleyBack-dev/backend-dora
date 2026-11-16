import type { ImageProcessorPort } from "@/shared/application/ports/image-processor.port";
import { decodeBase64Image } from "@/shared/domain/image-upload";

// A document people send as base64 (a PIX receipt, a birth certificate, a
// student card…): a PDF is kept as sent; an image (JPEG, PNG, WebP) is
// re-encoded from its pixels (no EXIF/GPS, nothing hidden in the original).

/** Largest file (as sent, before base64). */
export const DOCUMENT_MAX_BYTES = 1_200_000;
/** Images are shrunk to fit this side (still readable when zoomed). */
export const DOCUMENT_IMAGE_MAX_SIDE = 2400;

export type PreparedDocument = {
  data: Buffer;
  contentType: string;
  extension: "pdf" | "webp";
};

/** A PDF by its first bytes ("%PDF-"). */
export const isPdf = (data: Buffer) =>
  data.subarray(0, 5).toString("latin1") === "%PDF-";

/** The document ready to store, or null when it isn't a PDF nor an image. */
export async function prepareDocument(
  images: ImageProcessorPort,
  base64: string,
): Promise<PreparedDocument | null> {
  const raw = decodeBase64Image(base64, DOCUMENT_MAX_BYTES);
  if (!raw) return null;
  if (isPdf(raw)) {
    return { data: raw, contentType: "application/pdf", extension: "pdf" };
  }
  const image = await images.spacePhoto(raw, {
    maxBytes: DOCUMENT_MAX_BYTES,
    maxSide: DOCUMENT_IMAGE_MAX_SIDE,
  });
  return image
    ? { data: image.data, contentType: image.contentType, extension: "webp" }
    : null;
}

/** "comprovante-EV7K2QMX.pdf" for a stored document. */
export const documentFileName = (base: string, contentType: string | null) =>
  `${base}.${contentType === "application/pdf" ? "pdf" : "webp"}`;
