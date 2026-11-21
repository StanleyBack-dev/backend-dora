import { Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import type {
  ReturnReceiptDocument,
  ReturnReceiptRendererPort,
} from "@/modules/lost-and-found/application/ports/return-receipt-renderer.port";
import { CATEGORY_LABELS } from "@/modules/lost-and-found/domain/found-item";
import { formatDateTime } from "@/shared/domain/local-date";
import { deviceFacts } from "@/shared/domain/signature/signature-capture";
import {
  BAD,
  GOOD,
  locationText,
  MUTED,
  PdfWriter,
  ROLE_LABELS,
} from "@/shared/infrastructure/pdf/pdf-writer";

// The return receipt of a lost item as an A4 PDF (pdf-lib, standard
// fonts): the item, who took it back, the declaration, the signature as
// drawn, the evidence and its SHA-256 codes, whether the record is intact,
// and a QR to the item in the app, where the integrity is checked again.
@Injectable()
export class PdfLibReturnReceiptRenderer implements ReturnReceiptRendererPort {
  async render(input: ReturnReceiptDocument): Promise<Buffer> {
    const { item, signature, timeZone } = input;
    const when = (date: Date) => formatDateTime(date, timeZone);

    const doc = await PDFDocument.create();
    doc.setTitle(`Comprovante de devolução: ${item.title}`);
    doc.setSubject("Comprovante de devolução de item achado");
    doc.setProducer("Dora");
    doc.setCreator("Dora");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const out = new PdfWriter(doc, font, bold);

    out.text(input.condominiumName, { size: 10, color: MUTED });
    out.text("Comprovante de devolução de item achado", {
      size: 17,
      bold: true,
      gap: 2,
    });
    out.text(`${item.title} · emitido em ${when(input.issuedAt)}`, {
      size: 9,
      color: MUTED,
    });
    out.rule();

    out.heading("Item");
    out.facts([
      ["Item", item.title],
      ["Categoria", CATEGORY_LABELS[item.category]],
      ["Descrição", item.description],
      ["Achado em", `${item.foundLocation} · ${when(item.foundAt)}`],
      [
        "Registrado",
        `${when(item.createdAt)}${item.registeredByName ? ` por ${item.registeredByName}` : ""}`,
      ],
      ["Guardado em", item.storageLocation],
    ]);

    out.heading("Devolução");
    out.facts([
      [
        "Quem retirou",
        `${signature.signerName}${input.signerDocumentMasked && signature.signerDocumentType ? ` · ${signature.signerDocumentType} ${input.signerDocumentMasked}` : ""}`,
      ],
      ["Pedido de", item.returnedToName],
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
      [
        "Observação",
        signature.selfHandover
          ? "Entregue pela própria pessoa que pediu: era a única da equipe do condomínio no momento."
          : null,
      ],
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
      "Assinatura eletrônica feita na tela de quem devolveu o item, registrada pelo Dora com a data e a hora, o endereço IP, o aparelho, a localização (quando permitida) e quem entregou. Os códigos SHA-256 permitem conferir que o registro não foi alterado.",
    );

    return Buffer.from(await doc.save());
  }
}
