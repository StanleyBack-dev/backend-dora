import {
  rgb,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import {
  LocationStatus,
  type SignatureLocation,
} from "@/shared/domain/signature/signature-capture";

// A4 documents written top to bottom with pdf-lib's standard fonts: the
// signed receipts (parcels, lost and found) share the look and the layout.

export const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const WIDTH = A4.width - MARGIN * 2;
const INK = rgb(0.07, 0.07, 0.07);
export const MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.85, 0.85, 0.85);
const BRAND = rgb(0.76, 0.25, 0.05);
export const GOOD = rgb(0.08, 0.5, 0.24);
export const BAD = rgb(0.75, 0.1, 0.1);

/** Who handed something over, by role. */
export const ROLE_LABELS: Record<string, string> = {
  CONCIERGE: "Portaria",
  ADMIN: "Administração",
  ADMIN_MASTER: "Administração",
};

const LOCATION_LABELS: Record<LocationStatus, string> = {
  [LocationStatus.GRANTED]: "Localização registrada",
  [LocationStatus.DENIED]: "Localização recusada no aparelho",
  [LocationStatus.UNAVAILABLE]: "Localização indisponível",
};

/** The signing location as a line: coordinates, or why there are none. */
export function locationText(location: SignatureLocation): string {
  return location.status === LocationStatus.GRANTED
    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${location.accuracyMeters !== null ? ` (± ${Math.round(location.accuracyMeters)} m)` : ""}`
    : LOCATION_LABELS[location.status];
}

type TextOptions = {
  size?: number;
  bold?: boolean;
  color?: RGB;
  x?: number;
  width?: number;
  gap?: number;
};

/** Writes top to bottom, adding pages as needed. */
export class PdfWriter {
  private page: PDFPage;
  private y = A4.height - MARGIN;

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
  ) {
    this.page = doc.addPage([A4.width, A4.height]);
  }

  /** The standard fonts only encode WinAnsi: anything else becomes "?". */
  private safe(text: string): string {
    return [...text.normalize("NFC")]
      .map((char) => {
        try {
          this.font.encodeText(char);
          return char;
        } catch {
          return "?";
        }
      })
      .join("");
  }

  private ensure(height: number) {
    if (this.y - height >= MARGIN) return;
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN;
  }

  /** Splits text into lines that fit `width` (long words are cut). */
  private wrap(text: string, font: PDFFont, size: number, width: number) {
    const fits = (value: string) =>
      font.widthOfTextAtSize(value, size) <= width;
    const lines: string[] = [];
    for (const paragraph of this.safe(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        let piece = word;
        while (!fits(piece)) {
          let cut = piece.length - 1;
          while (cut > 1 && !fits(piece.slice(0, cut))) cut -= 1;
          if (line) lines.push(line);
          lines.push(piece.slice(0, cut));
          line = "";
          piece = piece.slice(cut);
        }
        const next = line ? `${line} ${piece}` : piece;
        if (!fits(next) && line) {
          lines.push(line);
          line = piece;
        } else {
          line = next;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(value: string, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const font = options.bold ? this.bold : this.font;
    const lineHeight = size * 1.3;
    for (const line of this.wrap(value, font, size, options.width ?? WIDTH)) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.page.drawText(line, {
        x: options.x ?? MARGIN,
        y: this.y + size * 0.25,
        size,
        font,
        color: options.color ?? INK,
      });
    }
    this.y -= options.gap ?? 0;
  }

  space(height: number) {
    this.y -= height;
  }

  rule() {
    this.ensure(16);
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4.width - MARGIN, y: this.y },
      thickness: 0.6,
      color: LINE,
    });
    this.y -= 10;
  }

  heading(value: string) {
    this.ensure(40);
    this.space(6);
    this.text(value.toUpperCase(), {
      size: 9,
      bold: true,
      color: BRAND,
      gap: 4,
    });
  }

  /** Label/value rows, the label in a fixed column. */
  facts(rows: [string, string | null | undefined][], valueSize = 10) {
    const labelWidth = 150;
    for (const [label, value] of rows) {
      if (!value) continue;
      this.ensure(14);
      const top = this.y;
      this.text(label, { size: 9, color: MUTED, width: labelWidth - 8 });
      const labelBottom = this.y;
      this.y = top;
      this.text(value, {
        x: MARGIN + labelWidth,
        width: WIDTH - labelWidth,
        size: valueSize,
      });
      this.y = Math.min(this.y, labelBottom) - 1.5;
    }
  }

  /** An image centred in a framed box. */
  image(image: PDFImage, maxHeight: number) {
    const scale = Math.min(
      (WIDTH - 16) / image.width,
      maxHeight / image.height,
      1,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    this.ensure(height + 20);
    this.y -= height + 8;
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 4,
      width: WIDTH,
      height: height + 8,
      borderColor: LINE,
      borderWidth: 0.6,
    });
    this.page.drawImage(image, {
      x: MARGIN + (WIDTH - width) / 2,
      y: this.y,
      width,
      height,
    });
    this.y -= 12;
  }

  /** The QR beside a short text, the link and a note. */
  qr(image: PDFImage, caption: string, url: string, note: string) {
    const size = 72;
    this.ensure(size + 12);
    const top = this.y;
    this.page.drawImage(image, {
      x: MARGIN,
      y: top - size,
      width: size,
      height: size,
    });
    const x = MARGIN + size + 12;
    this.text(caption, { x, width: WIDTH - size - 12, bold: true });
    this.text(url, {
      x,
      width: WIDTH - size - 12,
      size: 8,
      color: MUTED,
      gap: 6,
    });
    this.text(note, { x, width: WIDTH - size - 12, size: 8, color: MUTED });
    this.y = Math.min(this.y, top - size) - 8;
  }
}
