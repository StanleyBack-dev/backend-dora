import type { ConfigService } from "@nestjs/config";
import { AppException } from "@/common/exceptions/app-exception";
import { waitLabel } from "@/common/exceptions/catalogs/landing-errors.catalog";
import type { SecretsPort } from "@/modules/identity/application/ports/secrets.port";
import type { LandingLeadRepositoryPort } from "@/modules/landing/application/ports/landing-lead-repository.port";
import { SubmitLandingLeadUseCase } from "@/modules/landing/application/use-cases/submit-landing-lead.use-case";
import {
  LeadMailStatus,
  LeadRole,
  LeadSubject,
  type Lead,
  type LeadAttribution,
  type LeadDraft,
} from "@/modules/landing/domain/landing-lead";
import { LeadOutcome } from "@/modules/landing/domain/landing-lead-guards";
import type { SendLandingEmailsUseCase } from "@/modules/mails/application/use-cases/send-landing-emails.use-case";
import type { ClockPort } from "@/shared/application/ports/clock.port";
import type {
  RateLimitPort,
  RateWindow,
} from "@/shared/application/ports/rate-limit.port";

const NOW = new Date("2026-11-19T15:00:00Z");

const ATTRIBUTION: LeadAttribution = {
  visitorId: null,
  referrerHost: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
};

const draft = (change: Partial<LeadDraft> = {}): LeadDraft => ({
  name: "Ana Souza",
  email: "ana@example.com",
  phone: null,
  condominium: null,
  role: LeadRole.SINDICO,
  unitsRange: null,
  subject: LeadSubject.DEMONSTRACAO,
  message: "Quero conhecer o app do condomínio.",
  ...change,
});

/** Fixed windows in memory (same contract as the database store). */
class MemoryRateLimit implements Partial<RateLimitPort> {
  readonly counts = new Map<string, number>();
  hit(key: string, windowMs: number): Promise<RateWindow> {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return Promise.resolve({
      count,
      resetAt: new Date(NOW.getTime() + windowMs),
    });
  }
}

class MemoryLeads implements LandingLeadRepositoryPort {
  readonly rows: Lead[] = [];
  create(lead: LeadDraft & LeadAttribution): Promise<Lead> {
    const row: Lead = {
      ...lead,
      id: `lead-${this.rows.length + 1}`,
      mailStatus: LeadMailStatus.PENDING,
      createdAt: NOW,
    };
    this.rows.push(row);
    return Promise.resolve(row);
  }
  setMailStatus(id: string, status: LeadMailStatus): Promise<void> {
    const row = this.rows.find((item) => item.id === id);
    if (row) row.mailStatus = status;
    return Promise.resolve();
  }
  hasDuplicateSince(email: string, message: string): Promise<boolean> {
    return Promise.resolve(
      this.rows.some((row) => row.email === email && row.message === message),
    );
  }
  list(): never {
    throw new Error("not used");
  }
}

function setup(mailsPerHour?: number) {
  const leads = new MemoryLeads();
  const limits = new MemoryRateLimit();
  const mails = {
    leadReceived: jest.fn().mockResolvedValue(undefined),
    leadConfirmation: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new SubmitLandingLeadUseCase(
    leads,
    limits as unknown as RateLimitPort,
    { digest: (value: string) => `h(${value})` } as unknown as SecretsPort,
    { now: () => NOW } as unknown as ClockPort,
    mails as unknown as SendLandingEmailsUseCase,
    {
      get: (key: string) =>
        key === "LANDING_LEADS_MAIL_HOURLY_LIMIT" ? mailsPerHour : undefined,
    } as unknown as ConfigService,
  );
  const submit = (change: Partial<LeadDraft> = {}, ip = "10.0.0.1") =>
    useCase.execute(draft(change), ATTRIBUTION, ip);
  return { leads, limits, mails, submit };
}

const message = (index: number) => `Mensagem de teste número ${index}.`;

describe("SubmitLandingLeadUseCase", () => {
  it("stores, e-mails the inbox and confirms to the visitor", async () => {
    const { leads, mails, submit } = setup();
    await expect(submit()).resolves.toBe(LeadOutcome.SENT);
    expect(leads.rows).toHaveLength(1);
    expect(leads.rows[0].mailStatus).toBe(LeadMailStatus.SENT);
    expect(mails.leadReceived).toHaveBeenCalledTimes(1);
    expect(mails.leadConfirmation).toHaveBeenCalledTimes(1);
  });

  it("ignores a resend of the same message (no row, no e-mail)", async () => {
    const { leads, mails, submit } = setup();
    await submit();
    await expect(submit({}, "10.0.0.2")).resolves.toBe(LeadOutcome.DUPLICATE);
    expect(leads.rows).toHaveLength(1);
    expect(mails.leadReceived).toHaveBeenCalledTimes(1);
  });

  it("limits one IP to 5 messages an hour", async () => {
    const { submit } = setup();
    for (let i = 0; i < 5; i++) {
      await submit({ email: `p${i}@example.com`, message: message(i) });
    }
    await expect(
      submit({ email: "p9@example.com", message: message(9) }),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("limits one e-mail to 3 messages a day, whatever the IP", async () => {
    const { submit } = setup();
    for (let i = 0; i < 3; i++) {
      await submit({ message: message(i) }, `10.0.1.${i}`);
    }
    await expect(
      submit({ message: message(9) }, "10.0.1.9"),
    ).rejects.toBeInstanceOf(AppException);
  });

  it("tells the wait in minutes or hours", () => {
    expect(waitLabel(15)).toBe("15 min");
    expect(waitLabel(60)).toBe("1 h");
    expect(waitLabel(1440)).toBe("24 h");
  });

  it("confirms to the same recipient at most once a day", async () => {
    const { mails, submit } = setup();
    await submit({ message: message(1) });
    await submit({ message: message(2) });
    expect(mails.leadReceived).toHaveBeenCalledTimes(2);
    expect(mails.leadConfirmation).toHaveBeenCalledTimes(1);
  });

  it("holds leads without e-mail once the hourly limit is reached", async () => {
    const { leads, mails, submit } = setup(2);
    const outcomes = [];
    for (let i = 0; i < 3; i++) {
      outcomes.push(
        await submit(
          { email: `q${i}@example.com`, message: message(i) },
          `10.0.2.${i}`,
        ),
      );
    }
    expect(outcomes).toEqual([
      LeadOutcome.SENT,
      LeadOutcome.SENT,
      LeadOutcome.HELD,
    ]);
    expect(leads.rows).toHaveLength(3);
    expect(leads.rows[2].mailStatus).toBe(LeadMailStatus.HELD);
    expect(mails.leadReceived).toHaveBeenCalledTimes(2);
  });

  it("keeps the lead when the inbox e-mail fails", async () => {
    const { leads, mails, submit } = setup();
    mails.leadReceived.mockRejectedValueOnce(new Error("Brevo down"));
    await expect(submit()).resolves.toBe(LeadOutcome.STORED);
    expect(leads.rows[0].mailStatus).toBe(LeadMailStatus.FAILED);
    expect(mails.leadConfirmation).not.toHaveBeenCalled();
  });
});
