// Images people send as base64 (the browser already resized them). The
// server decodes them here with a size cap, then checks and re-encodes the
// pixels in the image processor.

/** Formats accepted, detected from the file content. */
export const IMAGE_FORMATS = ["jpeg", "png", "webp"] as const;

/** Largest source image, against decompression bombs. */
export const IMAGE_MAX_PIXELS = 40_000_000;

/** Base64 (no data: prefix) -> bytes; null if not base64 or over `maxBytes`. */
export function decodeBase64Image(
  base64: string,
  maxBytes: number,
): Buffer | null {
  const text = base64.trim();
  if (
    text.length === 0 ||
    text.length > Math.ceil((maxBytes * 4) / 3) + 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(text)
  ) {
    return null;
  }
  const data = Buffer.from(text, "base64");
  return data.length > 0 && data.length <= maxBytes ? data : null;
}
