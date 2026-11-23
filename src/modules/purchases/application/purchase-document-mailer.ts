import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { SendDocumentEmailUseCase } from "@/modules/mails/application/use-cases/send-document-email.use-case";
import { requestInvalid } from "@/modules/purchases/application/purchase-errors";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";

/** E-mails per person in a window (each address counts one). */
const SEND_LIMIT = 30;
const SEND_WINDOW_MS = 60 * 60 * 1000;

export const EMAIL_LIMITS = { maxRecipients: 5, message: 1000 } as const;

/** A purchase document to send, already rendered. */
export type PurchaseDocumentEmail = {
  subject: string;
  condominiumName: string;
  details: { label: string; value: string }[];
  fileName: string;
  content: Buffer;
  tag: string;
};

/**
 * Sends a purchase document (the comparison map, the purchase order) by
 * e-mail: 1 to 5 addresses, the sender's message, the PDF attached and
 * replies to whoever sent it. Limited per person, so it can't spam.
 */
@Injectable()
export class PurchaseDocumentMailer {
  constructor(
    private readonly documents: SendDocumentEmailUseCase,
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
  ) {}

  /** The addresses and the message, checked (before rendering the PDF). */
  check(emails: string[], message: string) {
    const to = [
      ...new Set(emails.map((email) => email.trim().toLowerCase())),
    ].filter(Boolean);
    const text = message.trim();
    if (to.length === 0 || to.length > EMAIL_LIMITS.maxRecipients) {
      throw requestInvalid(
        `Informe de 1 a ${EMAIL_LIMITS.maxRecipients} e-mails.`,
      );
    }
    if (!text || text.length > EMAIL_LIMITS.message) {
      throw requestInvalid(
        `Escreva a mensagem (até ${EMAIL_LIMITS.message} caracteres).`,
      );
    }
    return { to, text };
  }

  async send(
    actor: AuthenticatedUser,
    recipients: { to: string[]; text: string },
    document: PurchaseDocumentEmail,
  ): Promise<number> {
    let window = { count: 0, resetAt: new Date() };
    for (let sent = 0; sent < recipients.to.length; sent += 1) {
      window = await this.limits.hit(
        `purchase-share:${actor.id}`,
        SEND_WINDOW_MS,
      );
    }
    if (window.count > SEND_LIMIT) {
      throw AppException.from(APP_ERRORS.purchases.shareLimit, {
        minutes: Math.max(
          1,
          Math.ceil((window.resetAt.getTime() - Date.now()) / 60_000),
        ),
      });
    }
    await this.documents.send({
      to: recipients.to,
      subject: document.subject,
      senderLine: `${actor.name}, do ${document.condominiumName},`,
      message: recipients.text,
      details: document.details,
      replyTo: actor.email
        ? { email: actor.email, name: actor.name }
        : undefined,
      file: {
        name: document.fileName,
        content: document.content,
        contentType: "application/pdf",
      },
      tag: document.tag,
    });
    return recipients.to.length;
  }
}
