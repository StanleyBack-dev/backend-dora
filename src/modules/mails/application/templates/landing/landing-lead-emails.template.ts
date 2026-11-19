import { EMAIL_BRAND } from "@/modules/mails/application/templates/layout/email-brand";
import {
  escapeHtml,
  renderStandardEmailLayout,
} from "@/modules/mails/application/templates/layout/standard-email-layout.template";

export type RenderedEmail = { subject: string; html: string; text: string };

/** A landing page lead, already turned into labels. */
export type LandingLeadEmailContent = {
  name: string;
  email: string;
  subjectLabel: string;
  message: string;
  /** Label → value lines (phone, condominium, role…), only the filled ones. */
  details: [string, string][];
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** The message the Dora team receives; replying goes to the visitor. */
export function renderLandingLeadNotificationEmail(
  lead: LandingLeadEmailContent,
): RenderedEmail {
  const subject = `[Site] ${lead.subjectLabel} · ${lead.name}`;
  const rows = lead.details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:${EMAIL_BRAND.textSoft};font-size:13px;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;color:${EMAIL_BRAND.text};">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const html = renderStandardEmailLayout({
    title: subject,
    preheader: `${lead.name} escreveu pela landing page do Dora.`,
    heading: "Nova mensagem pelo site",
    contentHtml: `
      <table role="presentation" cellspacing="0" cellpadding="0">${rows}</table>
      <div style="margin:18px 0 0 0;padding:16px 18px;background:${EMAIL_BRAND.accentSoft};border-radius:12px;color:${EMAIL_BRAND.text};white-space:pre-wrap;">${escapeHtml(lead.message)}</div>
      <p style="margin-top:18px;">Responda este e-mail para falar direto com ${escapeHtml(firstName(lead.name))}.</p>`,
    footerNote: "Mensagem enviada pelo formulário de contato da landing page.",
  });
  const text = [
    "Nova mensagem pelo site",
    "",
    ...lead.details.map(([label, value]) => `${label}: ${value}`),
    "",
    lead.message,
  ].join("\n");
  return { subject, html, text };
}

/** Confirmation to the visitor. */
export function renderLandingLeadConfirmationEmail(
  lead: LandingLeadEmailContent,
): RenderedEmail {
  const subject = "Recebemos sua mensagem · Dora";
  const name = firstName(lead.name);
  const html = renderStandardEmailLayout({
    title: subject,
    preheader: "Obrigado pelo contato. Vamos responder em até 1 dia útil.",
    heading: `Olá, ${name}! Recebemos sua mensagem.`,
    contentHtml: `
      <p>Obrigado pelo contato com o <strong>Dora</strong>. Nossa equipe vai responder em até 1 dia útil.</p>
      <p>Assunto: <strong>${escapeHtml(lead.subjectLabel)}</strong></p>
      <p>Se quiser complementar, é só responder este e-mail.</p>`,
    footerNote:
      "Você recebeu este e-mail porque enviou uma mensagem pelo site do Dora.",
  });
  const text = `Olá, ${name}! Recebemos sua mensagem e vamos responder em até 1 dia útil.\nAssunto: ${lead.subjectLabel}\n\nEquipe Dora`;
  return { subject, html, text };
}
