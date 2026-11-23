import { Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type {
  PurchaseOrderInput,
  PurchaseOrderRendererPort,
} from "@/modules/purchases/application/ports/purchase-order-renderer.port";
import { PdfWriter } from "@/shared/infrastructure/pdf/pdf-writer";

/**
 * The purchase order (ordem de compra) as an A4 portrait PDF, in the Dora
 * look, to send to the supplier: who buys, who sells, where and when to
 * deliver, the items with their prices, the totals, how it is paid (each
 * installment with its due day), notes and lines to sign.
 */
@Injectable()
export class PdfLibPurchaseOrderRenderer implements PurchaseOrderRendererPort {
  async render(input: PurchaseOrderInput): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Ordem de compra ${input.code}`);
    doc.setSubject(`Ordem de compra ${input.code} · ${input.request}`);
    doc.setProducer("Dora");
    doc.setCreator("Dora");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const out = new PdfWriter(doc, font, bold, {
      label: "Ordem de compra",
      subtitle: input.condominium.name,
      footer: `${input.code} · ${input.request} · em ${input.generatedAt}`,
    });

    out.intro(`Ordem de compra ${input.code}`, input.request);

    out.heading("Comprador");
    out.facts([
      ["Condomínio", input.condominium.name],
      ...input.condominium.facts,
    ]);

    out.heading("Fornecedor");
    out.facts([["Fornecedor", input.supplier.name], ...input.supplier.facts]);

    out.heading("Entrega");
    out.facts(input.delivery);

    out.heading(`Itens (${input.items.length})`);
    out.facts(input.items);

    out.heading("Valores");
    out.facts(input.totals);

    out.heading("Pagamento");
    out.facts(input.payment);

    if (input.notes) {
      out.heading("Observações");
      out.text(input.notes, { size: 9, gap: 4 });
    }

    out.signatures(input.signers);
    out.finish();
    return Buffer.from(await doc.save());
  }
}
