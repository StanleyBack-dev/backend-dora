import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { PurchaseDocumentMailer } from "@/modules/purchases/application/purchase-document-mailer";
import { ListPurchaseQuotesUseCase } from "@/modules/purchases/application/use-cases/list-purchase-quotes.use-case";

/**
 * The management sends the comparison map by e-mail (to the board, the
 * trustee…) with the request's facts and the PDF attached.
 */
@Injectable()
export class ShareQuoteMapUseCase {
  constructor(
    private readonly listing: ListPurchaseQuotesUseCase,
    private readonly mailer: PurchaseDocumentMailer,
  ) {}

  async byEmail(
    actor: AuthenticatedUser,
    requestId: string,
    emails: string[],
    message: string,
  ): Promise<number> {
    const recipients = this.mailer.check(emails, message);
    const file = await this.listing.mapPdf(actor, requestId);
    return this.mailer.send(actor, recipients, {
      subject: `Mapa de cotação ${file.code} · ${file.title}`,
      condominiumName: file.condominiumName,
      details: [
        { label: "Solicitação", value: `${file.code} · ${file.title}` },
        { label: "Cotações", value: String(file.quoteCount) },
        ...(file.cheapest
          ? [{ label: "Menor total", value: file.cheapest }]
          : []),
        ...(file.chosen ? [{ label: "Escolhida", value: file.chosen }] : []),
      ],
      fileName: file.fileName,
      content: file.content,
      tag: "purchase-quote-map",
    });
  }
}
