export interface MailAddress {
  email: string;
  name?: string;
}

export interface MailAttachment {
  name: string;
  /** The file: UTF-8 text (an .ics calendar) or bytes (a PDF). */
  content: string | Buffer;
  contentType: string;
}

export interface SendMailCommand {
  to: MailAddress;
  subject: string;
  html: string;
  text?: string;
  replyTo?: MailAddress;
  tags?: string[];
  attachments?: MailAttachment[];
}

export interface MailProviderPort {
  send(command: SendMailCommand): Promise<void>;
}

export const MAIL_PROVIDER = Symbol("MAIL_PROVIDER");
