import { rgb, type PDFFont, type PDFPage } from "pdf-lib";

// The Dora look in PDFs: the app's palette and the logo, drawn as vectors
// (sharp at any size, no image to load).

const hex = (value: string) =>
  rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );

/** The frontend's tokens (globals.css). */
export const BRAND_COLORS = {
  orange: hex("#ff6b1a"),
  orangeInk: hex("#c2410c"),
  orangeSoft: hex("#fff1e8"),
  orangeBorder: hex("#ffd4bb"),
  black: hex("#0a0a0a"),
  ink: hex("#0a0a0a"),
  muted: hex("#57534e"),
  soft: hex("#8a847d"),
  line: hex("#e9e7e4"),
  surfaceMuted: hex("#f7f6f4"),
  white: rgb(1, 1, 1),
  success: hex("#15803d"),
  successSoft: hex("#ecfdf3"),
  successBorder: hex("#bbe5c8"),
  danger: hex("#c0362c"),
  dangerSoft: hex("#fdecea"),
  warning: hex("#92400e"),
  warningSoft: hex("#fff7e6"),
  info: hex("#1d4ed8"),
  infoSoft: hex("#eef3ff"),
} as const;

const TILE =
  "M16 0 H48 A16 16 0 0 1 64 16 V48 A16 16 0 0 1 48 64 H16 A16 16 0 0 1 0 48 V16 A16 16 0 0 1 16 0 Z";
const STEM =
  "M43.5 12 A3.5 3.5 0 0 1 47 15.5 V49 A3.5 3.5 0 0 1 40 49 V15.5 A3.5 3.5 0 0 1 43.5 12 Z";

/** The mark (orange tile, black "d"), `size` points wide, top-left at (x, top). */
export function drawDoraMark(
  page: PDFPage,
  x: number,
  top: number,
  size: number,
) {
  const scale = size / 64;
  page.drawSvgPath(TILE, { x, y: top, scale, color: BRAND_COLORS.orange });
  page.drawCircle({
    x: x + 31 * scale,
    y: top - 38 * scale,
    size: 11 * scale,
    borderColor: BRAND_COLORS.black,
    borderWidth: 7 * scale,
  });
  page.drawSvgPath(STEM, { x, y: top, scale, color: BRAND_COLORS.black });
}

/** The "dora." wordmark from its baseline; returns its width. */
export function drawWordmark(
  page: PDFPage,
  font: PDFFont,
  x: number,
  baseline: number,
  size: number,
  color = BRAND_COLORS.white,
): number {
  page.drawText("dora", { x, y: baseline, size, font, color });
  const name = font.widthOfTextAtSize("dora", size);
  page.drawText(".", {
    x: x + name,
    y: baseline,
    size,
    font,
    color: BRAND_COLORS.orange,
  });
  return name + font.widthOfTextAtSize(".", size);
}
