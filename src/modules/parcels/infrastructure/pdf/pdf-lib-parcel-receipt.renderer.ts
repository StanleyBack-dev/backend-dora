import { Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import type {
  ParcelReceiptDocument,
  ParcelReceiptRendererPort,
} from "@/modules/parcels/application/ports/parcel-receipt-renderer.port";
import {
  deviceFacts,
  maskDocument,
} from "@/modules/parcels/domain/parcel-signature";
import { formatDateTime } from "@/shared/domain/local-date";
import {
  locationText,
  MUTED,
  PdfWriter,
  ROLE_LABELS,
} from "@/shared/infrastructure/pdf/pdf-writer";

/** "ABC 234": the pickup code as it is read aloud. */
const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

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
    const out = new PdfWriter(doc, font, bold, {
      label: "Comprovante de retirada",
      subtitle: input.condominiumName,
      footer: `Encomenda ${spacedCode(parcel.pickupCode)} · emitido em ${when(input.issuedAt)}`,
    });

    out.intro(
      "Comprovante de retirada de encomenda",
      `Código ${spacedCode(parcel.pickupCode)} · emitido em ${when(input.issuedAt)}`,
    );

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

    out.heading("Retirada");
    out.facts([
      [
        "Quem retirou",
        `${signature.signerName}${input.signerDocumentMasked ? ` · ${signature.signerDocumentType} ${input.signerDocumentMasked}` : ""}`,
      ],
      [
        "Autorização",
        parcel.authorizedName && parcel.authorizedAt
          ? `${parcel.authorizedName}${parcel.authorizedDocumentType && parcel.authorizedDocument ? ` (${parcel.authorizedDocumentType} ${maskDocument(parcel.authorizedDocumentType, parcel.authorizedDocument)})` : ""}, autorizada${parcel.authorizedByName ? ` por ${parcel.authorizedByName}` : ""} em ${when(parcel.authorizedAt)}`
          : null,
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
      ["Localização", locationText(signature.location)],
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
      out.image(image, 72);
    } else {
      out.text(
        "A imagem da assinatura não pôde ser carregada; confira no app.",
        { color: MUTED },
      );
    }

    out.heading("Integridade");
    out.notice(
      signature.intact
        ? "Registro íntegro: as provas guardadas conferem com o código gravado na assinatura."
        : "Registro alterado: as provas guardadas não conferem com o código gravado na assinatura.",
      signature.intact ? "good" : "bad",
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

    out.finish();
    return Buffer.from(await doc.save());
  }
}
