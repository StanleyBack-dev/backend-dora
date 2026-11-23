import { Inject, Injectable } from "@nestjs/common";
import {
  MAIL_PROVIDER,
  type MailProviderPort,
} from "@/modules/mails/application/ports/mail-provider.port";
import {
  type DocumentEmailContent,
  renderDocumentEmail,
} from "@/modules/mails/application/templates/documents/document-email.template";

export type DocumentEmail = Omit<DocumentEmailContent, "fileName"> & {
  /** Each gets their own e-mail (nobody sees the others' addresses). */
  to: string[];
  /** Replies go to whoever sent it (none: no address on file). */
  replyTo?: { email: string; name: string };
  file: { name: string; content: Buffer; contentType: string };
  tag: string;
};

// Sends a document someone shares from the app, attached, right away (the
// person waits to know it went out; a failure is shown to them).
@Injectable()
export class SendDocumentEmailUseCase {
  constructor(@Inject(MAIL_PROVIDER) private readonly mail: MailProviderPort) {}

  async send(email: DocumentEmail): Promise<void> {
    const rendered = renderDocumentEmail({
      subject: email.subject,
      senderLine: email.senderLine,
      message: email.message,
      details: email.details,
      fileName: email.file.name,
    });
    for (const address of email.to) {
      await this.mail.send({
        to: { email: address },
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: email.replyTo,
        tags: [email.tag],
        attachments: [email.file],
      });
    }
  }
}
