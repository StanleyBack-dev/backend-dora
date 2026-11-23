import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { SendDocumentEmailUseCase } from "@/modules/mails/application/use-cases/send-document-email.use-case";
import { ListPurchaseQuotesUseCase } from "@/modules/purchases/application/use-cases/list-purchase-quotes.use-case";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";

/** E-mails per person in a window (each address counts one). */
const SHARE_LIMIT = 30;
const SHARE_WINDOW_MS = 60 * 60 * 1000;

export const SHARE_LIMITS = { maxRecipients: 5, message: 1000 } as const;

// The management sends the comparison map by e-mail (to the board, the
// trustee…): the PDF attached, their message, the request's facts. Replies
// go to whoever sent it. Limited per person, so it can't be used to spam.
@Injectable()
export class ShareQuoteMapUseCase {
  constructor(
    private readonly listing: ListPurchaseQuotesUseCase,
    private readonly documents: SendDocumentEmailUseCase,
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
  ) {}

  async byEmail(
    actor: AuthenticatedUser,
    requestId: string,
    emails: string[],
    message: string,
  ): Promise<number> {
    const to = [
      ...new Set(emails.map((email) => email.trim().toLowerCase())),
    ].filter(Boolean);
    const text = message.trim();
    if (to.length === 0 || to.length > SHARE_LIMITS.maxRecipients) {
      throw AppException.from(APP_ERRORS.purchases.requestInvalid, {
        reason: `Informe de 1 a ${SHARE_LIMITS.maxRecipients} e-mails.`,
      });
    }
    if (!text || text.length > SHARE_LIMITS.message) {
      throw AppException.from(APP_ERRORS.purchases.requestInvalid, {
        reason: `Escreva a mensagem (até ${SHARE_LIMITS.message} caracteres).`,
      });
    }
    const file = await this.listing.mapPdf(actor, requestId);

    let window = { count: 0, resetAt: new Date() };
    for (let sent = 0; sent < to.length; sent += 1) {
      window = await this.limits.hit(
        `purchase-share:${actor.id}`,
        SHARE_WINDOW_MS,
      );
    }
    if (window.count > SHARE_LIMIT) {
      throw AppException.from(APP_ERRORS.purchases.shareLimit, {
        minutes: Math.max(
          1,
          Math.ceil((window.resetAt.getTime() - Date.now()) / 60_000),
        ),
      });
    }

    await this.documents.send({
      to,
      subject: `Mapa de cotação ${file.code} · ${file.title}`,
      senderLine: `${actor.name}, do ${file.condominiumName},`,
      message: text,
      details: [
        { label: "Solicitação", value: `${file.code} · ${file.title}` },
        { label: "Cotações", value: String(file.quoteCount) },
        ...(file.cheapest
          ? [{ label: "Menor total", value: file.cheapest }]
          : []),
        ...(file.chosen ? [{ label: "Escolhida", value: file.chosen }] : []),
      ],
      replyTo: actor.email
        ? { email: actor.email, name: actor.name }
        : undefined,
      file: {
        name: file.fileName,
        content: file.content,
        contentType: "application/pdf",
      },
      tag: "purchase-quote-map",
    });
    return to.length;
  }
}
