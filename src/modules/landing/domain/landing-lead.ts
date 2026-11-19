import { normalizePhone } from "@/shared/domain/phone";

// A message sent through the landing page's contact form (a lead). Nobody is
// signed in: it is stored and e-mailed to the Dora inbox.

export enum LeadRole {
  SINDICO = "SINDICO",
  ADMINISTRADORA = "ADMINISTRADORA",
  CONSELHO = "CONSELHO",
  MORADOR = "MORADOR",
  OUTRO = "OUTRO",
}

export enum LeadSubject {
  DEMONSTRACAO = "DEMONSTRACAO",
  ORCAMENTO = "ORCAMENTO",
  DUVIDA = "DUVIDA",
  PARCERIA = "PARCERIA",
  SUPORTE = "SUPORTE",
}

export enum LeadUnitsRange {
  ATE_50 = "ATE_50",
  DE_51_A_150 = "DE_51_A_150",
  DE_151_A_400 = "DE_151_A_400",
  MAIS_DE_400 = "MAIS_DE_400",
}

/** Whether the e-mail to the Dora inbox went out. */
export enum LeadMailStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  /** Not sent on purpose: the hourly e-mail limit (anti-flood) was hit. */
  HELD = "HELD",
}

export const LEAD_ROLE_LABELS: Record<LeadRole, string> = {
  [LeadRole.SINDICO]: "Síndico(a)",
  [LeadRole.ADMINISTRADORA]: "Administradora",
  [LeadRole.CONSELHO]: "Conselho / subsíndico",
  [LeadRole.MORADOR]: "Morador(a)",
  [LeadRole.OUTRO]: "Outro",
};

export const LEAD_SUBJECT_LABELS: Record<LeadSubject, string> = {
  [LeadSubject.DEMONSTRACAO]: "Quero uma demonstração",
  [LeadSubject.ORCAMENTO]: "Planos e valores",
  [LeadSubject.DUVIDA]: "Tenho uma dúvida",
  [LeadSubject.PARCERIA]: "Parceria / integração",
  [LeadSubject.SUPORTE]: "Já uso o Dora (suporte)",
};

export const LEAD_UNITS_LABELS: Record<LeadUnitsRange, string> = {
  [LeadUnitsRange.ATE_50]: "Até 50 unidades",
  [LeadUnitsRange.DE_51_A_150]: "51 a 150 unidades",
  [LeadUnitsRange.DE_151_A_400]: "151 a 400 unidades",
  [LeadUnitsRange.MAIS_DE_400]: "Mais de 400 unidades",
};

export const LEAD_LIMITS = {
  name: 120,
  email: 160,
  phone: 30,
  condominium: 160,
  message: 3000,
  attribution: 100,
  referrerHost: 200,
} as const;

/** Where the visitor came from (UTM parameters and the referring site). */
export type LeadAttribution = {
  visitorId: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

export type LeadDraft = {
  name: string;
  email: string;
  phone: string | null;
  condominium: string | null;
  role: LeadRole;
  unitsRange: LeadUnitsRange | null;
  subject: LeadSubject;
  message: string;
};

export type Lead = LeadDraft &
  LeadAttribution & {
    id: string;
    mailStatus: LeadMailStatus;
    createdAt: Date;
  };

export type LeadViolation =
  "name-required" | "email-invalid" | "phone-invalid" | "message-required";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** DDD + number (10 digits, or 11 for a mobile starting with 9). */
const isPhone = (digits: string) =>
  /^\d{10}$/.test(digits) || /^\d{2}9\d{8}$/.test(digits);

/** The first problem of a draft (already trimmed), or null. */
export function checkLeadDraft(draft: LeadDraft): LeadViolation | null {
  if (draft.name.length < 2) return "name-required";
  if (!EMAIL.test(draft.email)) return "email-invalid";
  if (draft.phone && !isPhone(draft.phone)) return "phone-invalid";
  if (draft.message.length < 10) return "message-required";
  return null;
}

/**
 * Trims every text; empty optional ones become null. The phone keeps only
 * its digits (DDD + number, a leading +55 dropped), like the app stores it.
 */
export function normalizeLeadDraft(draft: LeadDraft): LeadDraft {
  const optional = (value: string | null) => value?.trim() || null;
  return {
    ...draft,
    name: draft.name.trim().replace(/\s+/g, " "),
    email: draft.email.trim().toLowerCase(),
    phone: draft.phone?.trim()
      ? (normalizePhone(draft.phone) ?? draft.phone.trim())
      : null,
    condominium: optional(draft.condominium),
    message: draft.message.trim(),
  };
}
