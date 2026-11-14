import sharp from "sharp";
import {
  SPACE_PHOTO_MAX_BYTES,
  SPACE_PHOTO_MAX_SIDE,
} from "@/modules/spaces/domain/space-photo";
import { decodeBase64Image } from "@/shared/domain/image-upload";
import { SharpImageProcessor } from "@/shared/infrastructure/sharp-image-processor";

const LIMITS = {
  maxBytes: SPACE_PHOTO_MAX_BYTES,
  maxSide: SPACE_PHOTO_MAX_SIDE,
};
const processor = new SharpImageProcessor();

const image = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: "#ff6b1a" },
  });

describe("space photos", () => {
  it("re-encodes a JPEG as a WebP that fits 1600 px, keeping proportions", async () => {
    const input = await image(3200, 1800).jpeg().toBuffer();
    const output = await processor.spacePhoto(input, LIMITS);
    expect(output?.contentType).toBe("image/webp");
    const meta = await sharp(output!.data).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1600, 900]);
  });

  it("never enlarges a small photo", async () => {
    const input = await image(800, 600).png().toBuffer();
    const meta = await sharp(
      (await processor.spacePhoto(input, LIMITS))!.data,
    ).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
  });

  it("drops the metadata (EXIF, GPS) of the original", async () => {
    const input = await image(400, 300)
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret gps" } } })
      .toBuffer();
    const meta = await sharp(
      (await processor.spacePhoto(input, LIMITS))!.data,
    ).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it.each([
    [
      "an SVG (could carry scripts)",
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
    ],
    ["text renamed as an image", Buffer.from("not an image at all")],
  ])("rejects %s", async (_label, input) => {
    expect(await processor.spacePhoto(input, LIMITS)).toBeNull();
  });

  it("rejects GIFs and files over the size limit", async () => {
    const gif = await image(10, 10).gif().toBuffer();
    expect(await processor.spacePhoto(gif, LIMITS)).toBeNull();
    const big = Buffer.alloc(SPACE_PHOTO_MAX_BYTES + 1, 1);
    expect(await processor.spacePhoto(big, LIMITS)).toBeNull();
  });

  it("decodes base64 only within the limit", () => {
    expect(decodeBase64Image("aGVsbG8=", 10)?.toString()).toBe("hello");
    expect(decodeBase64Image("aGVsbG8=", 3)).toBeNull();
    expect(decodeBase64Image("%%%", 10)).toBeNull();
    expect(decodeBase64Image("", 10)).toBeNull();
  });
});
