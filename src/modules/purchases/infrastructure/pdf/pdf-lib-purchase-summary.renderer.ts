import { Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type {
  PurchaseSummaryInput,
  PurchaseSummaryRendererPort,
} from "@/modules/purchases/application/ports/purchase-summary-renderer.port";
import { PdfWriter } from "@/shared/infrastructure/pdf/pdf-writer";

/**
 * The purchase summary (resumo da compra) as an A4 portrait PDF, in the
 * Dora look: where it stands, the request and its items, every quote in one
 * line, the chosen one with the justification, what happened (the
 * timeline) and lines to sign. One document for any outcome, to file or to
 * account for the purchase; the comparison map has the prices side by side.
 */
@Injectable()
export class PdfLibPurchaseSummaryRenderer implements PurchaseSummaryRendererPort {
  async render(input: PurchaseSummaryInput): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Resumo da compra ${input.code}`);
    doc.setSubject("Resumo da compra: solicitação, cotações e aprovação");
    doc.setProducer("Dora");
    doc.setCreator("Dora");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const out = new PdfWriter(doc, font, bold, {
      label: "Resumo da compra",
      subtitle: input.condominiumName,
      footer: `${input.code} · ${input.title} · em ${input.generatedAt}`,
    });

    out.intro(input.title, `${input.code} · ${input.statusLabel}`);
    out.notice(input.status.line, input.status.tone);

    out.heading("Solicitação");
    out.facts(input.facts);
    if (input.details) out.text(input.details, { size: 9, gap: 4 });

    out.heading(`Itens (${input.items.length})`);
    out.facts(input.items.map((item) => [item.label, item.quantity]));

    out.heading(`Cotações (${input.quotes.length})`);
    if (input.quotes.length) {
      out.facts(input.quotes.map((quote) => [quote.supplier, quote.line]));
    } else {
      out.text("Nenhuma cotação registrada.", { size: 9 });
    }

    if (input.choice) {
      out.heading("Cotação escolhida");
      out.facts([["Fornecedor", input.choice.supplier], ...input.choice.facts]);
    }

    out.heading("Linha do tempo");
    out.facts(input.timeline.map((entry) => [entry.at, entry.event]));

    out.signatures(input.signers);
    out.finish();
    return Buffer.from(await doc.save());
  }
}
