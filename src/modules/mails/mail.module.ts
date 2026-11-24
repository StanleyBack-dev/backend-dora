import { Logger, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MAIL_PROVIDER } from "@/modules/mails/application/ports/mail-provider.port";
import { SendDocumentEmailUseCase } from "@/modules/mails/application/use-cases/send-document-email.use-case";
import { SendIdentityEmailsUseCase } from "@/modules/mails/application/use-cases/send-identity-emails.use-case";
import { SendLandingEmailsUseCase } from "@/modules/mails/application/use-cases/send-landing-emails.use-case";
import { SendNotificationEmailUseCase } from "@/modules/mails/application/use-cases/send-notification-email.use-case";
import { BrevoMailProvider } from "@/modules/mails/infrastructure/providers/brevo-mail.provider";
import { DevRedirectMailProvider } from "@/modules/mails/infrastructure/providers/dev-redirect-mail.provider";
import { LogMailProvider } from "@/modules/mails/infrastructure/providers/log-mail.provider";
import { mailDeliveryFor } from "@/modules/mails/infrastructure/providers/mail-driver";

@Module({
  providers: [
    BrevoMailProvider,
    LogMailProvider,
    DevRedirectMailProvider,
    {
      // Only production e-mails real people (see mail-driver.ts).
      provide: MAIL_PROVIDER,
      inject: [
        ConfigService,
        BrevoMailProvider,
        DevRedirectMailProvider,
        LogMailProvider,
      ],
      useFactory: (
        config: ConfigService,
        brevo: BrevoMailProvider,
        redirect: DevRedirectMailProvider,
        log: LogMailProvider,
      ) => {
        const delivery = mailDeliveryFor({
          nodeEnv: config.get<string>("NODE_ENV"),
          driver: config.get<string>("MAIL_DRIVER"),
          redirectTo: config.get<string>("MAIL_DEV_REDIRECT_TO"),
        });
        if (
          delivery === "log" &&
          config.get<string>("MAIL_DRIVER") === "brevo"
        ) {
          new Logger(MailModule.name).warn(
            "Fora de produção: e-mails só no log (defina MAIL_DEV_REDIRECT_TO para recebê-los num endereço seu).",
          );
        }
        return delivery === "send"
          ? brevo
          : delivery === "redirect"
            ? redirect
            : log;
      },
    },
    SendIdentityEmailsUseCase,
    SendNotificationEmailUseCase,
    SendLandingEmailsUseCase,
    SendDocumentEmailUseCase,
  ],
  exports: [
    SendIdentityEmailsUseCase,
    SendNotificationEmailUseCase,
    SendLandingEmailsUseCase,
    SendDocumentEmailUseCase,
  ],
})
export class MailModule {}
