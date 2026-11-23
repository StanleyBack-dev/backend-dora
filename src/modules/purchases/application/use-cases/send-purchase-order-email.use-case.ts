import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { PurchaseDocumentMailer } from "@/modules/purchases/application/purchase-document-mailer";
import { PurchaseOrderPdfUseCase } from "@/modules/purchases/application/use-cases/purchase-order-pdf.use-case";

/**
 * The management sends the purchase order to the supplier by e-mail: the
 * PDF attached, their message and the order's facts; replies go to whoever
 * sent it.
 */
@Injectable()
export class SendPurchaseOrderEmailUseCase {
  constructor(
    private readonly pdf: PurchaseOrderPdfUseCase,
    private readonly mailer: PurchaseDocumentMailer,
  ) {}

  async send(
    actor: AuthenticatedUser,
    requestId: string,
    emails: string[],
    message: string,
  ): Promise<number> {
    const recipients = this.mailer.check(emails, message);
    const file = await this.pdf.render(actor, requestId);
    return this.mailer.send(actor, recipients, {
      subject: `Ordem de compra ${file.code} · ${file.condominiumName}`,
      condominiumName: file.condominiumName,
      details: [
        { label: "Ordem de compra", value: file.code },
        { label: "Solicitação", value: file.request },
        { label: "Total", value: file.total },
      ],
      fileName: file.fileName,
      content: file.content,
      tag: "purchase-order",
    });
  }
}
