import type { PDFDocument, PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import {
  LocationStatus,
  type SignatureLocation,
} from "@/shared/domain/signature/signature-capture";
import {
  BRAND_COLORS as C,
  drawDoraMark,
  drawWordmark,
} from "@/shared/infrastructure/pdf/pdf-brand";
import { fitText, wrapText } from "@/shared/infrastructure/pdf/pdf-text";

// A4 portrait documents written top to bottom with pdf-lib's standard
// fonts, in the Dora look (as the quote map): a black header with the mark
// and the document's name on every page, sections with the orange bar,
// label/value tables, status boxes, and a footer with the page count. The
// signed receipts (parcels, lost and found) use it.

export const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const WIDTH = A4.width - MARGIN * 2;
const HEADER = 54;
const TOP = A4.height - HEADER - 3 - 24;
const BOTTOM = 54;
export const MUTED = C.muted;
export const GOOD = C.success;
export const BAD = C.danger;

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

/** What every page's header and footer say. */
export type PdfFrame = {
  /** The document's kind, in the header ("Comprovante de retirada"). */
  label: string;
  /** Under it (the condominium). */
  subtitle: string;
  /** The footer's left side ("Emitido em 22/11/2026 10:00"). */
  footer: string;
};

/** Writes top to bottom, adding pages (with the header) as needed. */
export class PdfWriter {
  private readonly pages: PDFPage[] = [];
  private page!: PDFPage;
  private y = TOP;

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly frame: PdfFrame,
  ) {
    this.addPage();
  }

  private addPage() {
    this.page = this.doc.addPage([A4.width, A4.height]);
    this.pages.push(this.page);
    const top = A4.height;
    this.page.drawRectangle({
      x: 0,
      y: top - HEADER,
      width: A4.width,
      height: HEADER,
      color: C.black,
    });
    this.page.drawRectangle({
      x: 0,
      y: top - HEADER - 3,
      width: A4.width,
      height: 3,
      color: C.orange,
    });
    drawDoraMark(this.page, MARGIN, top - 13, 28);
    drawWordmark(this.page, this.bold, MARGIN + 37, top - 33, 18);
    this.right(this.frame.label.toUpperCase(), top - 23, {
      font: this.bold,
      size: 7.5,
      color: C.orange,
    });
    this.right(this.frame.subtitle, top - 39, {
      font: this.bold,
      size: 11,
      color: C.white,
      width: 330,
    });
    this.y = TOP;
  }

  private right(
    value: string,
    baseline: number,
    options: { font: PDFFont; size: number; color: RGB; width?: number },
  ) {
    const text = fitText(
      options.font,
      value,
      options.size,
      options.width ?? 330,
    );
    this.page.drawText(text, {
      x: A4.width - MARGIN - options.font.widthOfTextAtSize(text, options.size),
      y: baseline,
      size: options.size,
      font: options.font,
      color: options.color,
    });
  }

  private ensure(height: number) {
    if (this.y - height >= BOTTOM) return;
    this.addPage();
  }

  private lines(text: string, font: PDFFont, size: number, width: number) {
    return wrapText(font, text, size, width);
  }

  text(value: string, options: TextOptions = {}) {
    const size = options.size ?? 10;
    const font = options.bold ? this.bold : this.font;
    const lineHeight = size * 1.35;
    for (const line of this.lines(value, font, size, options.width ?? WIDTH)) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.page.drawText(line, {
        x: options.x ?? MARGIN,
        y: this.y + size * 0.25,
        size,
        font,
        color: options.color ?? C.ink,
      });
    }
    this.y -= options.gap ?? 0;
  }

  space(height: number) {
    this.y -= height;
  }

  /** The document's title and one line under it. */
  intro(title: string, meta: string) {
    this.text(title, { size: 18, bold: true, gap: 2 });
    this.text(meta, { size: 9, color: C.muted, gap: 10 });
  }

  rule() {
    this.ensure(16);
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4.width - MARGIN, y: this.y },
      thickness: 0.6,
      color: C.line,
    });
    this.y -= 10;
  }

  /** A section title with the orange bar. */
  heading(value: string) {
    this.ensure(52);
    this.y -= 12;
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 13,
      width: 3,
      height: 13,
      color: C.orange,
    });
    this.page.drawText(this.lines(value, this.bold, 11.5, WIDTH)[0] ?? "", {
      x: MARGIN + 9,
      y: this.y - 10.5,
      size: 11.5,
      font: this.bold,
      color: C.ink,
    });
    this.y -= 22;
  }

  /** Label/value rows in a table: labels in a column, rows striped. */
  facts(rows: [string, string | null | undefined][], valueSize = 9.5) {
    const labelWidth = 150;
    const pad = 6;
    const shown = rows.filter((row): row is [string, string] =>
      Boolean(row[1]),
    );
    shown.forEach(([label, value], index) => {
      const labels = this.lines(label, this.bold, 8, labelWidth - pad * 2);
      const values = this.lines(
        value,
        this.font,
        valueSize,
        WIDTH - labelWidth - pad,
      );
      const lineHeight = valueSize * 1.35;
      const height =
        Math.max(labels.length * 10.5, values.length * lineHeight) + pad * 2;
      this.ensure(height);
      const top = this.y;
      this.page.drawRectangle({
        x: MARGIN,
        y: top - height,
        width: WIDTH,
        height,
        color: index % 2 === 0 ? C.surfaceMuted : C.white,
      });
      this.page.drawLine({
        start: { x: MARGIN, y: top - height },
        end: { x: MARGIN + WIDTH, y: top - height },
        thickness: 0.5,
        color: C.line,
      });
      labels.forEach((line, at) =>
        this.page.drawText(line, {
          x: MARGIN + pad,
          y: top - pad - 8 - at * 10.5,
          size: 8,
          font: this.bold,
          color: C.muted,
        }),
      );
      values.forEach((line, at) =>
        this.page.drawText(line, {
          x: MARGIN + labelWidth,
          y: top - pad - valueSize * 0.95 - at * lineHeight,
          size: valueSize,
          font: this.font,
          color: C.ink,
        }),
      );
      this.y = top - height;
    });
    this.y -= 4;
  }

  /** A highlighted box (a status): tinted, with a bar in its color. */
  notice(value: string, tone: "good" | "bad" | "waiting" | "info") {
    const color = {
      good: C.success,
      bad: C.danger,
      waiting: C.warning,
      info: C.info,
    }[tone];
    const fill = {
      good: C.successSoft,
      bad: C.dangerSoft,
      waiting: C.warningSoft,
      info: C.infoSoft,
    }[tone];
    const lines = this.lines(value, this.bold, 10, WIDTH - 32);
    const height = lines.length * 13.5 + 18;
    this.ensure(height + 6);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: WIDTH,
      height,
      color: fill,
    });
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: 4,
      height,
      color,
    });
    lines.forEach((line, at) =>
      this.page.drawText(line, {
        x: MARGIN + 18,
        y: top - 9 - 10 - at * 13.5,
        size: 10,
        font: this.bold,
        color,
      }),
    );
    this.y = top - height - 8;
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
    this.ensure(height + 24);
    this.y -= height + 10;
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 6,
      width: WIDTH,
      height: height + 12,
      color: C.white,
      borderColor: C.line,
      borderWidth: 0.75,
    });
    this.page.drawImage(image, {
      x: MARGIN + (WIDTH - width) / 2,
      y: this.y,
      width,
      height,
    });
    this.y -= 14;
  }

  /** The QR beside a short text, the link and a note, in a soft box. */
  qr(image: PDFImage, caption: string, url: string, note: string) {
    const size = 76;
    const textWidth = WIDTH - size - 36;
    const noteLines = this.lines(note, this.font, 8, textWidth);
    const height = Math.max(size + 20, 46 + noteLines.length * 10.8);
    this.ensure(height + 6);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: WIDTH,
      height,
      color: C.orangeSoft,
      borderColor: C.orangeBorder,
      borderWidth: 0.75,
    });
    this.page.drawImage(image, {
      x: MARGIN + 10,
      y: top - 10 - size,
      width: size,
      height: size,
    });
    const x = MARGIN + size + 24;
    this.y = top - 6;
    this.text(caption, { x, width: textWidth, bold: true, size: 10.5 });
    this.text(url, {
      x,
      width: textWidth,
      size: 8,
      color: C.orangeInk,
      gap: 4,
    });
    this.text(note, { x, width: textWidth, size: 8, color: C.muted });
    this.y = top - height - 8;
  }

  /** Lines to sign side by side: the name in bold under each, the role below. */
  signatures(signers: { name: string; role: string }[], title = "Assinaturas") {
    if (signers.length === 0) return;
    const gap = 30;
    const width = (WIDTH - gap * (signers.length - 1)) / signers.length;
    // The title stays on the page with the lines.
    this.ensure(52 + 70);
    this.heading(title);
    this.y -= 40;
    signers.forEach((signer, index) => {
      const x = MARGIN + index * (width + gap);
      this.page.drawLine({
        start: { x, y: this.y },
        end: { x: x + width, y: this.y },
        thickness: 0.75,
        color: C.soft,
      });
      const name = fitText(this.bold, signer.name || " ", 9, width);
      this.page.drawText(name, {
        x,
        y: this.y - 12,
        size: 9,
        font: this.bold,
        color: C.ink,
      });
      this.page.drawText(fitText(this.font, signer.role, 7.5, width), {
        x,
        y: this.y - 23,
        size: 7.5,
        font: this.font,
        color: C.muted,
      });
    });
    this.y -= 32;
  }

  /** The footer on every page (call once, at the end). */
  finish() {
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN, y: BOTTOM - 18 },
        end: { x: A4.width - MARGIN, y: BOTTOM - 18 },
        thickness: 0.5,
        color: C.line,
      });
      const left = fitText(
        this.font,
        `Gerado pelo Dora · ${this.frame.footer}`,
        7,
        WIDTH - 80,
      );
      page.drawText(left, {
        x: MARGIN,
        y: BOTTOM - 31,
        size: 7,
        font: this.font,
        color: C.soft,
      });
      const right = `Página ${index + 1} de ${total}`;
      page.drawText(right, {
        x: A4.width - MARGIN - this.font.widthOfTextAtSize(right, 7),
        y: BOTTOM - 31,
        size: 7,
        font: this.font,
        color: C.soft,
      });
    });
  }
}
