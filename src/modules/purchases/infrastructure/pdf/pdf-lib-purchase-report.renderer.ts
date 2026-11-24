import { Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type {
  PurchaseReportInput,
  PurchaseReportRendererPort,
} from "@/modules/purchases/application/ports/purchase-report-renderer.port";
import { PdfWriter } from "@/shared/infrastructure/pdf/pdf-writer";

/**
 * A purchases report as an A4 landscape PDF in the Dora look (as the
 * quote map): the period's figures in boxes, then each table (categories
 * with their share, months, suppliers, purchases), for meetings and the
 * notice board.
 */
@Injectable()
export class PdfLibPurchaseReportRenderer implements PurchaseReportRendererPort {
  async render(input: PurchaseReportInput): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.setTitle(`${input.title} · ${input.period}`);
    doc.setSubject(`${input.title} · ${input.condominiumName}`);
    doc.setProducer("Dora");
    doc.setCreator("Dora");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const out = new PdfWriter(doc, font, bold, {
      label: input.label,
      subtitle: input.condominiumName,
      footer: `${input.title} · ${input.period} · em ${input.generatedAt}`,
      landscape: true,
    });

    out.intro(input.title, input.period);
    out.stats(input.stats);

    if (input.facts) {
      out.heading(input.facts.title);
      out.facts(input.facts.rows);
    }

    for (const table of input.tables) {
      out.heading(table.title);
      out.table(table.columns, table.rows);
      if (table.note) out.text(table.note, { size: 8, gap: 4 });
    }

    out.finish();
    return Buffer.from(await doc.save());
  }
}
