import { decodeBase64Image } from "@/shared/domain/image-upload";

// Limits of profile photos. The browser already shrinks the photo before
// sending it; the server checks and re-encodes it anyway.

/** Largest file accepted (after the browser's resize it is far smaller). */
export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
/** Side of the stored square image. */
export const PROFILE_PHOTO_SIZE = 512;

/** Base64 (no data: prefix) -> bytes; null if not base64 or too large. */
export const decodePhoto = (base64: string): Buffer | null =>
  decodeBase64Image(base64, PROFILE_PHOTO_MAX_BYTES);
