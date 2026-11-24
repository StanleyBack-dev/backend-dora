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

// A4 documents (portrait, or landscape for reports) written top to bottom
// with pdf-lib's standard fonts, in the Dora look (as the quote map): a
// black header with the mark and the document's name on every page,
// sections with the orange bar, label/value tables, data tables, figures,
// status boxes, and a footer with the page count. The signed receipts
// (parcels, lost and found) and the purchases documents use it.

export const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 40;
const HEADER = 54;
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
  /** A4 landscape (reports with wide tables); portrait by default. */
  landscape?: boolean;
};

/** A column of `table`: its share of the width and alignment. */
export type PdfColumn = {
  label: string;
  /** Relative width (the columns' widths are shares of the page's). */
  width: number;
  align?: "left" | "right";
};

/** A cell of `table`: text, or a bar (0–1) with its label beside it. */
export type PdfCell = string | { bar: number; label: string };

/** A figure in `stats`: the label, the value in large type and a hint. */
export type PdfStat = { label: string; value: string; hint?: string };

/** Writes top to bottom, adding pages (with the header) as needed. */
export class PdfWriter {
  private readonly pages: PDFPage[] = [];
  private readonly pageWidth: number;
  private readonly pageHeight: number;
  /** The content's width (between the margins). */
  private readonly width: number;
  /** Where the content starts under the header. */
  private readonly top: number;
  private page!: PDFPage;
  private y = 0;

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly frame: PdfFrame,
  ) {
    this.pageWidth = frame.landscape ? A4.height : A4.width;
    this.pageHeight = frame.landscape ? A4.width : A4.height;
    this.width = this.pageWidth - MARGIN * 2;
    this.top = this.pageHeight - HEADER - 3 - 24;
    this.addPage();
  }

  private addPage() {
    this.page = this.doc.addPage([this.pageWidth, this.pageHeight]);
    this.pages.push(this.page);
    const top = this.pageHeight;
    this.page.drawRectangle({
      x: 0,
      y: top - HEADER,
      width: this.pageWidth,
      height: HEADER,
      color: C.black,
    });
    this.page.drawRectangle({
      x: 0,
      y: top - HEADER - 3,
      width: this.pageWidth,
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
    this.y = this.top;
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
      x:
        this.pageWidth -
        MARGIN -
        options.font.widthOfTextAtSize(text, options.size),
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
    for (const line of this.lines(
      value,
      font,
      size,
      options.width ?? this.width,
    )) {
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
      end: { x: this.pageWidth - MARGIN, y: this.y },
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
    this.page.drawText(
      this.lines(value, this.bold, 11.5, this.width)[0] ?? "",
      {
        x: MARGIN + 9,
        y: this.y - 10.5,
        size: 11.5,
        font: this.bold,
        color: C.ink,
      },
    );
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
        this.width - labelWidth - pad,
      );
      const lineHeight = valueSize * 1.35;
      const height =
        Math.max(labels.length * 10.5, values.length * lineHeight) + pad * 2;
      this.ensure(height);
      const top = this.y;
      this.page.drawRectangle({
        x: MARGIN,
        y: top - height,
        width: this.width,
        height,
        color: index % 2 === 0 ? C.surfaceMuted : C.white,
      });
      this.page.drawLine({
        start: { x: MARGIN, y: top - height },
        end: { x: MARGIN + this.width, y: top - height },
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
    const lines = this.lines(value, this.bold, 10, this.width - 32);
    const height = lines.length * 13.5 + 18;
    this.ensure(height + 6);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: this.width,
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
      (this.width - 16) / image.width,
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
      width: this.width,
      height: height + 12,
      color: C.white,
      borderColor: C.line,
      borderWidth: 0.75,
    });
    this.page.drawImage(image, {
      x: MARGIN + (this.width - width) / 2,
      y: this.y,
      width,
      height,
    });
    this.y -= 14;
  }

  /** The QR beside a short text, the link and a note, in a soft box. */
  qr(image: PDFImage, caption: string, url: string, note: string) {
    const size = 76;
    const textWidth = this.width - size - 36;
    const noteLines = this.lines(note, this.font, 8, textWidth);
    const height = Math.max(size + 20, 46 + noteLines.length * 10.8);
    this.ensure(height + 6);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN,
      y: top - height,
      width: this.width,
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

  /** Figures side by side in boxes: the label, the value large, a hint. */
  stats(items: PdfStat[]) {
    if (items.length === 0) return;
    const gap = 8;
    const width = (this.width - gap * (items.length - 1)) / items.length;
    const height = 58;
    this.ensure(height + 8);
    const top = this.y;
    items.forEach((item, index) => {
      const x = MARGIN + index * (width + gap);
      this.page.drawRectangle({
        x,
        y: top - height,
        width,
        height,
        color: C.surfaceMuted,
        borderColor: C.line,
        borderWidth: 0.6,
      });
      this.page.drawText(
        fitText(this.bold, item.label.toUpperCase(), 7, width - 16),
        { x: x + 8, y: top - 15, size: 7, font: this.bold, color: C.muted },
      );
      this.page.drawText(fitText(this.bold, item.value, 15, width - 16), {
        x: x + 8,
        y: top - 35,
        size: 15,
        font: this.bold,
        color: C.ink,
      });
      if (item.hint) {
        this.page.drawText(fitText(this.font, item.hint, 7.5, width - 16), {
          x: x + 8,
          y: top - 49,
          size: 7.5,
          font: this.font,
          color: C.muted,
        });
      }
    });
    this.y = top - height - 10;
  }

  /**
   * A data table: a dark header row (repeated on each new page), striped
   * rows, each cell cut to its column; a bar cell draws its share (0–1)
   * with the label beside it.
   */
  table(columns: PdfColumn[], rows: PdfCell[][], empty = "Nada no período.") {
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / total) * this.width);
    const pad = 6;
    const rowHeight = 18;
    const header = () => {
      this.ensure(rowHeight * 2);
      const top = this.y;
      this.page.drawRectangle({
        x: MARGIN,
        y: top - rowHeight,
        width: this.width,
        height: rowHeight,
        color: C.black,
      });
      let x = MARGIN;
      columns.forEach((column, index) => {
        this.cell(column.label.toUpperCase(), x, top, widths[index], {
          align: column.align,
          font: this.bold,
          size: 7,
          color: C.white,
        });
        x += widths[index];
      });
      this.y = top - rowHeight;
    };
    header();
    if (rows.length === 0) {
      this.text(empty, { size: 9, color: C.muted, x: MARGIN + pad, gap: 6 });
      return;
    }
    rows.forEach((row, rowIndex) => {
      if (this.y - rowHeight < BOTTOM) {
        this.addPage();
        header();
      }
      const top = this.y;
      this.page.drawRectangle({
        x: MARGIN,
        y: top - rowHeight,
        width: this.width,
        height: rowHeight,
        color: rowIndex % 2 === 0 ? C.white : C.surfaceMuted,
      });
      let x = MARGIN;
      row.forEach((value, index) => {
        const width = widths[index];
        if (typeof value === "string") {
          this.cell(value, x, top, width, {
            align: columns[index].align,
            font: this.font,
            size: 8.5,
            color: C.ink,
          });
        } else {
          const label = value.label;
          const labelWidth = this.font.widthOfTextAtSize(label, 8);
          const barMax = Math.max(0, width - pad * 3 - labelWidth);
          const share = Math.min(1, Math.max(0, value.bar));
          if (share > 0) {
            this.page.drawRectangle({
              x: x + pad,
              y: top - rowHeight / 2 - 3,
              width: Math.max(share * barMax, 1.5),
              height: 6,
              color: C.orange,
            });
          }
          this.page.drawText(label, {
            x: x + pad * 2 + share * barMax,
            y: top - rowHeight / 2 - 2.8,
            size: 8,
            font: this.font,
            color: C.muted,
          });
        }
        x += width;
      });
      this.page.drawLine({
        start: { x: MARGIN, y: top - rowHeight },
        end: { x: MARGIN + this.width, y: top - rowHeight },
        thickness: 0.4,
        color: C.line,
      });
      this.y = top - rowHeight;
    });
    this.y -= 8;
  }

  private cell(
    value: string,
    x: number,
    top: number,
    width: number,
    options: {
      align?: "left" | "right";
      font: PDFFont;
      size: number;
      color: RGB;
    },
  ) {
    const pad = 6;
    const text = fitText(options.font, value, options.size, width - pad * 2);
    const textWidth = options.font.widthOfTextAtSize(text, options.size);
    this.page.drawText(text, {
      x: options.align === "right" ? x + width - pad - textWidth : x + pad,
      y: top - 12,
      size: options.size,
      font: options.font,
      color: options.color,
    });
  }

  /** Lines to sign side by side: the name in bold under each, the role below. */
  signatures(signers: { name: string; role: string }[], title = "Assinaturas") {
    if (signers.length === 0) return;
    const gap = 30;
    const width = (this.width - gap * (signers.length - 1)) / signers.length;
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
        end: { x: this.pageWidth - MARGIN, y: BOTTOM - 18 },
        thickness: 0.5,
        color: C.line,
      });
      const left = fitText(
        this.font,
        `Gerado pelo Dora · ${this.frame.footer}`,
        7,
        this.width - 80,
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
        x: this.pageWidth - MARGIN - this.font.widthOfTextAtSize(right, 7),
        y: BOTTOM - 31,
        size: 7,
        font: this.font,
        color: C.soft,
      });
    });
  }
}
