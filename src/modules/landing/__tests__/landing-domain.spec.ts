import {
  LandingEventType,
  cleanEvents,
  isBotAgent,
} from "@/modules/landing/domain/landing-event";
import {
  LeadRole,
  LeadSubject,
  checkLeadDraft,
  normalizeLeadDraft,
  type LeadDraft,
} from "@/modules/landing/domain/landing-lead";
import {
  periodFirstDay,
  resolveLandingDays,
} from "@/modules/landing/domain/landing-period";

const draft = (change: Partial<LeadDraft> = {}): LeadDraft => ({
  name: "  Ana   Souza ",
  email: " Ana@Example.com ",
  phone: " ",
  condominium: null,
  role: LeadRole.SINDICO,
  unitsRange: null,
  subject: LeadSubject.DEMONSTRACAO,
  message: "  Quero conhecer o app.  ",
  ...change,
});

describe("landing lead", () => {
  it("normalizes texts and empties optional fields", () => {
    const lead = normalizeLeadDraft(draft());
    expect(lead.name).toBe("Ana Souza");
    expect(lead.email).toBe("ana@example.com");
    expect(lead.phone).toBeNull();
    expect(lead.message).toBe("Quero conhecer o app.");
    expect(checkLeadDraft(lead)).toBeNull();
  });

  it("reports the first problem", () => {
    const check = (change: Partial<LeadDraft>) =>
      checkLeadDraft(normalizeLeadDraft(draft(change)));
    expect(check({ name: "A" })).toBe("name-required");
    expect(check({ email: "ana@" })).toBe("email-invalid");
    expect(check({ phone: "abc" })).toBe("phone-invalid");
    expect(check({ phone: "(11) 9999-000" })).toBe("phone-invalid");
    expect(check({ phone: "(11) 89999-0000" })).toBe("phone-invalid");
    expect(check({ phone: "+55 (11) 99999-0000" })).toBeNull();
    expect(check({ phone: "(62) 3333-0000" })).toBeNull();
    expect(check({ message: "oi" })).toBe("message-required");
  });

  it("requires name, e-mail and message even when blank", () => {
    const check = (change: Partial<LeadDraft>) =>
      checkLeadDraft(normalizeLeadDraft(draft(change)));
    expect(check({ name: "   " })).toBe("name-required");
    expect(check({ email: "  " })).toBe("email-invalid");
    expect(check({ message: "          " })).toBe("message-required");
  });

  it("stores the phone as digits only", () => {
    expect(
      normalizeLeadDraft(draft({ phone: "+55 (11) 99999-0000" })).phone,
    ).toBe("11999990000");
    expect(normalizeLeadDraft(draft({ phone: "(62) 3333-0000" })).phone).toBe(
      "6233330000",
    );
  });
});

describe("landing events", () => {
  it("drops malformed events and caps the batch", () => {
    const events = cleanEvents([
      { type: LandingEventType.CLICK, name: "whatsapp:hero", path: "/" },
      { type: LandingEventType.CLICK, name: "<script>", path: "/" },
      { type: LandingEventType.PAGE_VIEW, name: null, path: "http://x" },
      ...Array.from({ length: 40 }, () => ({
        type: LandingEventType.PAGE_VIEW,
        name: "",
        path: "/",
      })),
    ]);
    expect(events[0]).toEqual({
      type: LandingEventType.CLICK,
      name: "whatsapp:hero",
      path: "/",
    });
    expect(events.some((event) => event.name === "<script>")).toBe(false);
    expect(events.length).toBeLessThanOrEqual(25);
    expect(events[1].name).toBeNull();
  });

  it("treats crawlers and missing agents as bots", () => {
    expect(isBotAgent(null)).toBe(true);
    expect(isBotAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotAgent("WhatsApp/2.23")).toBe(true);
    expect(
      isBotAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1"),
    ).toBe(false);
  });
});

describe("landing period", () => {
  it("snaps to an offered period", () => {
    expect(resolveLandingDays(7)).toBe(7);
    expect(resolveLandingDays(12)).toBe(30);
    expect(resolveLandingDays(null)).toBe(30);
  });

  it("finds the first day, today included", () => {
    expect(periodFirstDay("2026-11-19", 1)).toBe("2026-11-19");
    expect(periodFirstDay("2026-11-19", 7)).toBe("2026-11-13");
    expect(periodFirstDay("2026-03-01", 2)).toBe("2026-02-28");
  });
});
