import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  MAIL_PROVIDER,
  type MailProviderPort,
} from "@/modules/mails/application/ports/mail-provider.port";
import {
  renderLandingLeadConfirmationEmail,
  renderLandingLeadNotificationEmail,
  type LandingLeadEmailContent,
} from "@/modules/mails/application/templates/landing/landing-lead-emails.template";

// E-mails of the landing page's contact form. Failures throw: the caller
// records whether the inbox got the message (the lead is stored anyway).
@Injectable()
export class SendLandingEmailsUseCase {
  private readonly inbox: string;

  constructor(
    @Inject(MAIL_PROVIDER) private readonly mail: MailProviderPort,
    config: ConfigService,
  ) {
    this.inbox =
      config.get<string>("LANDING_LEADS_INBOX") ??
      "suporte.doragestao@gmail.com";
  }

  /** To the Dora inbox, with the visitor as reply-to. */
  async leadReceived(lead: LandingLeadEmailContent): Promise<void> {
    const rendered = renderLandingLeadNotificationEmail(lead);
    await this.mail.send({
      to: { email: this.inbox, name: "Dora" },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: { email: lead.email, name: lead.name },
      tags: ["landing-lead"],
    });
  }

  /** To the visitor, with the Dora inbox as reply-to. */
  async leadConfirmation(lead: LandingLeadEmailContent): Promise<void> {
    const rendered = renderLandingLeadConfirmationEmail(lead);
    await this.mail.send({
      to: { email: lead.email, name: lead.name },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: { email: this.inbox, name: "Dora" },
      tags: ["landing-lead-confirmation"],
    });
  }
}
