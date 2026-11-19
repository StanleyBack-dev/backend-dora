import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import {
  LANDING_LEAD_REPOSITORY,
  type LandingLeadRepositoryPort,
} from "@/modules/landing/application/ports/landing-lead-repository.port";
import {
  LEAD_LIMITS,
  LEAD_ROLE_LABELS,
  LEAD_SUBJECT_LABELS,
  LEAD_UNITS_LABELS,
  LeadMailStatus,
  checkLeadDraft,
  normalizeLeadDraft,
  type Lead,
  type LeadAttribution,
  type LeadDraft,
  type LeadViolation,
} from "@/modules/landing/domain/landing-lead";
import {
  LEAD_GUARDS,
  LeadOutcome,
} from "@/modules/landing/domain/landing-lead-guards";
import type { LandingLeadEmailContent } from "@/modules/mails/application/templates/landing/landing-lead-emails.template";
import { SendLandingEmailsUseCase } from "@/modules/mails/application/use-cases/send-landing-emails.use-case";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";
import { rateStatus, type RateRule } from "@/shared/domain/rate-limit";

const VIOLATION_MESSAGES: Record<LeadViolation, string> = {
  "name-required": "Informe seu nome.",
  "email-invalid": "Informe um e-mail válido.",
  "phone-invalid": "Informe o DDD e o número completo do WhatsApp.",
  "message-required": "Conte um pouco mais (mínimo de 10 caracteres).",
};

const clip = (value: string | null | undefined, max: number) =>
  value?.trim().slice(0, max) || null;

// Public: the landing page's contact form. Guarded against spam (see
// LEAD_GUARDS); the lead is stored first (never lost), then e-mailed to the
// Dora inbox, and the visitor gets a confirmation.
@Injectable()
export class SubmitLandingLeadUseCase {
  private readonly logger = new Logger(SubmitLandingLeadUseCase.name);
  private readonly mailRule: RateRule;

  constructor(
    @Inject(LANDING_LEAD_REPOSITORY)
    private readonly leads: LandingLeadRepositoryPort,
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly mails: SendLandingEmailsUseCase,
    config: ConfigService,
  ) {
    this.mailRule = {
      limit:
        Number(config.get("LANDING_LEADS_MAIL_HOURLY_LIMIT")) ||
        LEAD_GUARDS.defaultMailsPerHour,
      windowMs: LEAD_GUARDS.mailWindowMs,
    };
  }

  async execute(
    input: LeadDraft,
    attribution: LeadAttribution,
    ipAddress: string | null,
  ): Promise<LeadOutcome> {
    const draft = normalizeLeadDraft(input);
    const violation = checkLeadDraft(draft);
    if (violation) {
      throw AppException.from(APP_ERRORS.landing.invalidLead, {
        reason: VIOLATION_MESSAGES[violation],
      });
    }
    const now = this.clock.now();

    // 1. Per IP, then (a resend is not new) per e-mail, from any IP.
    await this.enforce(
      `landing:lead:ip:${this.secrets.digest(ipAddress ?? "unknown")}`,
      LEAD_GUARDS.perIp,
    );
    const resend = await this.leads.hasDuplicateSince(
      draft.email,
      draft.message,
      new Date(now.getTime() - LEAD_GUARDS.duplicateWindowMs),
    );
    if (resend) return LeadOutcome.DUPLICATE;
    await this.enforce(
      `landing:lead:email:${this.secrets.digest(draft.email)}`,
      LEAD_GUARDS.perEmail,
    );

    // 2. Stored before any e-mail: a lead is never lost.
    const lead = await this.leads.create({
      ...draft,
      visitorId: attribution.visitorId,
      referrerHost: clip(attribution.referrerHost, LEAD_LIMITS.referrerHost),
      utmSource: clip(attribution.utmSource, LEAD_LIMITS.attribution),
      utmMedium: clip(attribution.utmMedium, LEAD_LIMITS.attribution),
      utmCampaign: clip(attribution.utmCampaign, LEAD_LIMITS.attribution),
    });

    // 3. Circuit breaker on the shared Brevo quota.
    if (!(await this.allow("landing:lead:mails", this.mailRule))) {
      this.logger.warn(
        `Lead ${lead.id}: held without e-mail (hourly limit of ${this.mailRule.limit} reached)`,
      );
      await this.leads.setMailStatus(lead.id, LeadMailStatus.HELD);
      return LeadOutcome.HELD;
    }

    const content = emailContent(lead);
    try {
      await this.mails.leadReceived(content);
      await this.leads.setMailStatus(lead.id, LeadMailStatus.SENT);
    } catch (error) {
      this.logger.error(`Lead ${lead.id}: inbox e-mail failed`, error);
      await this.leads.setMailStatus(lead.id, LeadMailStatus.FAILED);
      return LeadOutcome.STORED;
    }

    // 4. Confirmation, at most once a day per recipient. Best effort: the
    // team already has the message.
    const confirm = await this.allow(
      `landing:lead:confirmation:${this.secrets.digest(lead.email)}`,
      LEAD_GUARDS.confirmationPerRecipient,
    );
    if (confirm) {
      await this.mails
        .leadConfirmation(content)
        .catch((error: unknown) =>
          this.logger.warn(`Lead ${lead.id}: confirmation failed: ${error}`),
        );
    }
    return LeadOutcome.SENT;
  }

  /** Counts one hit; false once the window went over its limit. */
  private async allow(key: string, rule: RateRule): Promise<boolean> {
    const window = await this.limits.hit(key, rule.windowMs);
    return window.count <= rule.limit;
  }

  /** Counts one hit; over the limit, refuses with the minutes to wait. */
  private async enforce(key: string, rule: RateRule): Promise<void> {
    const window = await this.limits.hit(key, rule.windowMs);
    // `hit` already counted this request: blocked only when it went over.
    const status = rateStatus(
      { ...window, count: window.count - 1 },
      rule,
      this.clock.now(),
    );
    if (status.blocked) {
      throw AppException.from(APP_ERRORS.landing.tooManyLeads, {
        minutes: status.retryAfterMinutes,
      });
    }
  }
}

function emailContent(lead: Lead): LandingLeadEmailContent {
  const origin = [
    lead.utmSource,
    lead.utmMedium,
    lead.utmCampaign,
    lead.referrerHost,
  ]
    .filter(Boolean)
    .join(" · ");
  const details: [string, string | null][] = [
    ["Nome", lead.name],
    ["E-mail", lead.email],
    ["Telefone", lead.phone],
    ["Condomínio", lead.condominium],
    ["Perfil", LEAD_ROLE_LABELS[lead.role]],
    ["Tamanho", lead.unitsRange && LEAD_UNITS_LABELS[lead.unitsRange]],
    ["Assunto", LEAD_SUBJECT_LABELS[lead.subject]],
    ["Origem", origin || null],
  ];
  return {
    name: lead.name,
    email: lead.email,
    subjectLabel: LEAD_SUBJECT_LABELS[lead.subject],
    message: lead.message,
    details: details.filter((row): row is [string, string] => !!row[1]),
  };
}
