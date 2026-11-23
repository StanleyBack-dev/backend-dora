import type { RenderedEmail } from "@/modules/mails/application/templates/identity/identity-emails.template";
import { EMAIL_BRAND } from "@/modules/mails/application/templates/layout/email-brand";
import {
  escapeHtml,
  renderStandardEmailLayout,
} from "@/modules/mails/application/templates/layout/standard-email-layout.template";

export type DocumentEmailContent = {
  subject: string;
  /** Who sends it ("Ana, do Residencial Jardim"). */
  senderLine: string;
  /** What the sender wrote (kept as typed, line breaks included). */
  message: string;
  /** Label/value rows about the document. */
  details: { label: string; value: string }[];
  /** The attached file's name. */
  fileName: string;
};

function detailsTable(details: DocumentEmailContent["details"]): string {
  if (details.length === 0) return "";
  const rows = details
    .map(
      ({ label, value }) => `
        <tr>
          <td style="padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap;color:${EMAIL_BRAND.textSoft};font-size:13px;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;vertical-align:top;color:${EMAIL_BRAND.text};font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;padding:12px 16px;width:100%;background:${EMAIL_BRAND.cardBackground};border:1px solid ${EMAIL_BRAND.border};border-radius:12px;">${rows}</table>`;
}

// A document someone shares from the app by e-mail (the quote map…): their
// message, the facts and the file attached.
export function renderDocumentEmail(
  content: DocumentEmailContent,
): RenderedEmail {
  const html = renderStandardEmailLayout({
    title: content.subject,
    preheader: content.message.slice(0, 120),
    heading: content.subject,
    contentHtml: `
      <p style="color:${EMAIL_BRAND.textSoft};font-size:13px;">${escapeHtml(content.senderLine)} enviou este documento pelo Dora.</p>
      <p style="white-space:pre-line;">${escapeHtml(content.message)}</p>
      ${detailsTable(content.details)}
      <p style="margin-top:16px;padding:12px 16px;background:${EMAIL_BRAND.accentSoft};border-radius:12px;font-size:14px;">📎 Em anexo: <strong>${escapeHtml(content.fileName)}</strong></p>`,
    footerNote:
      "Você recebeu este e-mail porque alguém o enviou a você pelo Dora. Para responder, use o “Responder” do seu e-mail.",
  });
  const text = [
    `${content.senderLine} enviou este documento pelo Dora.`,
    "",
    content.message,
    "",
    ...content.details.map(({ label, value }) => `${label}: ${value}`),
    "",
    `Em anexo: ${content.fileName}`,
  ].join("\n");
  return { subject: content.subject, html, text };
}
