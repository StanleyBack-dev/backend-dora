import { Injectable } from "@nestjs/common";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import QRCode from "qrcode";
import type {
  ParcelReceiptDocument,
  ParcelReceiptRendererPort,
} from "@/modules/parcels/application/ports/parcel-receipt-renderer.port";
import {
  deviceFacts,
  LocationStatus,
} from "@/modules/parcels/domain/parcel-signature";
import { formatDateTime } from "@/shared/domain/local-date";

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const WIDTH = A4.width - MARGIN * 2;
const INK = rgb(0.07, 0.07, 0.07);
const MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.85, 0.85, 0.85);
const BRAND = rgb(0.76, 0.25, 0.05);
const GOOD = rgb(0.08, 0.5, 0.24);
const BAD = rgb(0.75, 0.1, 0.1);

const ROLE_LABELS: Record<string, string> = {
  CONCIERGE: "Portaria",
  ADMIN: "Administração",
  ADMIN_MASTER: "Administração",
};

const LOCATION_LABELS: Record<LocationStatus, string> = {
  [LocationStatus.GRANTED]: "Localização registrada",
  [LocationStatus.DENIED]: "Localização recusada no aparelho",
  [LocationStatus.UNAVAILABLE]: "Localização indisponível",
};

/** "ABC 234": the pickup code as it is read aloud. */
const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

type TextOptions = {
  size?: number;
  bold?: boolean;
  color?: RGB;
  x?: number;
  width?: number;
  gap?: number;
};

/** Writes top to bottom, adding pages as needed. */
class Writer {
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
    const lineHeight = size * 1.35;
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
      this.y = Math.min(this.y, labelBottom) - 3;
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
    const size = 84;
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

// The pickup receipt as an A4 PDF (pdf-lib, standard fonts): the parcel,
// who picked it up, the declaration, the signature as drawn, the evidence
// and its SHA-256 codes, whether the record is intact, and a QR to the
// receipt in the app, where the integrity is checked again.
@Injectable()
export class PdfLibParcelReceiptRenderer implements ParcelReceiptRendererPort {
  async render(input: ParcelReceiptDocument): Promise<Buffer> {
    const { parcel, signature, timeZone } = input;
    const when = (date: Date) => formatDateTime(date, timeZone);

    const doc = await PDFDocument.create();
    doc.setTitle(`Comprovante de retirada ${spacedCode(parcel.pickupCode)}`);
    doc.setSubject("Comprovante de retirada de encomenda");
    doc.setProducer("Dora");
    doc.setCreator("Dora");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const out = new Writer(doc, font, bold);

    out.text(input.condominiumName, { size: 10, color: MUTED });
    out.text("Comprovante de retirada de encomenda", {
      size: 17,
      bold: true,
      gap: 2,
    });
    out.text(
      `Código ${spacedCode(parcel.pickupCode)} · emitido em ${when(input.issuedAt)}`,
      { size: 9, color: MUTED },
    );
    out.rule();

    out.heading("Encomenda");
    out.facts([
      ["Unidade", parcel.unitLabel ?? "Unidade removida"],
      ["Destinatário", parcel.recipientName],
      ["Transportadora", parcel.carrier],
      ["Rastreio", parcel.trackingCode],
      [
        "Recebida em",
        `${when(parcel.receivedAt)}${parcel.receivedByName ? ` por ${parcel.receivedByName}` : ""}`,
      ],
      [
        "Perecível",
        parcel.pickupDeadline
          ? `retirar até ${when(parcel.pickupDeadline)}`
          : null,
      ],
    ]);

    const { location } = signature;
    out.heading("Retirada");
    out.facts([
      [
        "Quem retirou",
        `${signature.signerName}${input.signerDocumentMasked ? ` · ${signature.signerDocumentType} ${input.signerDocumentMasked}` : ""}`,
      ],
      ["Assinado em (servidor)", when(signature.signedAt)],
      [
        "Hora do aparelho",
        signature.clientSignedAt
          ? `${when(signature.clientSignedAt)}${signature.clientTimeZone ? ` (${signature.clientTimeZone})` : ""}`
          : null,
      ],
      [
        "Entregue por",
        `${signature.collectedByName} · ${ROLE_LABELS[signature.collectedByRole] ?? signature.collectedByRole}`,
      ],
      ["Endereço IP", signature.ipAddress],
      [
        "Localização",
        location.status === LocationStatus.GRANTED &&
        location.latitude !== null &&
        location.longitude !== null
          ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${location.accuracyMeters !== null ? ` (± ${Math.round(location.accuracyMeters)} m)` : ""}`
          : LOCATION_LABELS[location.status],
      ],
      ["Aparelho", deviceFacts(signature.device)],
      ["Navegador", signature.userAgent],
    ]);

    out.heading("Declaração assinada");
    out.text(signature.declaration, { gap: 6 });

    out.heading("Assinatura");
    const image = input.signaturePng
      ? await doc.embedPng(input.signaturePng).catch(() => null)
      : null;
    if (image) {
      out.image(image, 90);
    } else {
      out.text(
        "A imagem da assinatura não pôde ser carregada; confira no app.",
        { color: MUTED },
      );
    }

    out.heading("Integridade");
    out.text(
      signature.intact
        ? "Registro íntegro: as provas guardadas conferem com o código gravado na assinatura."
        : "Registro alterado: as provas guardadas não conferem com o código gravado na assinatura.",
      { bold: true, color: signature.intact ? GOOD : BAD, gap: 4 },
    );
    out.facts(
      [
        ["SHA-256 das provas", signature.evidenceSha256],
        ["SHA-256 da imagem", signature.imageSha256],
        ["SHA-256 dos traços", signature.strokesSha256],
      ],
      8,
    );
    out.space(8);

    const qr = await QRCode.toBuffer(input.receiptUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    });
    out.qr(
      await doc.embedPng(qr),
      "Confira este comprovante no app",
      input.receiptUrl,
      "Assinatura eletrônica feita na tela de quem entregou a encomenda, registrada pelo Dora com a data e a hora, o endereço IP, o aparelho, a localização (quando permitida) e quem entregou. Os códigos SHA-256 permitem conferir que o registro não foi alterado.",
    );

    return Buffer.from(await doc.save());
  }
}
