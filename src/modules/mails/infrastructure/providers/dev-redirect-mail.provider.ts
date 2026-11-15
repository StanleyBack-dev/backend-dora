import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  MailProviderPort,
  SendMailCommand,
} from "@/modules/mails/application/ports/mail-provider.port";
import { BrevoMailProvider } from "@/modules/mails/infrastructure/providers/brevo-mail.provider";
import { maskEmail } from "@/common/logging/redact";

// Outside production with MAIL_DEV_REDIRECT_TO set: every e-mail really goes
// out through Brevo, but only to that address, with "[DEV]" and the masked
// original recipient in the subject. Lets the developer see the e-mails
// without ever writing to the people in the database.
@Injectable()
export class DevRedirectMailProvider implements MailProviderPort {
  private readonly logger = new Logger(DevRedirectMailProvider.name);
  private readonly redirectTo: string;

  constructor(
    config: ConfigService,
    private readonly brevo: BrevoMailProvider,
  ) {
    this.redirectTo = config.get<string>("MAIL_DEV_REDIRECT_TO")?.trim() ?? "";
  }

  send(command: SendMailCommand): Promise<void> {
    const original = maskEmail(command.to.email);
    this.logger.log(
      `[e-mail de desenvolvimento] para=${original} desviado para ${maskEmail(this.redirectTo)} assunto="${command.subject}"`,
    );
    return this.brevo.send({
      ...command,
      to: { email: this.redirectTo, name: command.to.name },
      subject: `[DEV → ${original}] ${command.subject}`,
      // Replies would reach a real person's address.
      replyTo: undefined,
    });
  }
}
