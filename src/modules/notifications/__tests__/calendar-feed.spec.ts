import { buildCalendarFeed } from "@/modules/notifications/domain/ics";

const entry = (uid: string, cancelled = false) => ({
  uid,
  sequence: 1,
  cancelled,
  start: new Date("2026-11-03T13:00:00Z"),
  end: new Date("2026-11-03T15:00:00Z"),
  summary: "Dora · Salão de festas, aniversário",
  location: "Área de lazer — Torre 2",
  description: null,
  url: "https://app.example/reservas/r1",
});

describe("buildCalendarFeed", () => {
  it("puts every event of the person in one calendar to subscribe to", () => {
    const ics = buildCalendarFeed(
      "Dora · Fulano",
      [entry("event-1@dora"), entry("event-2@dora", true)],
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Dora · Fulano");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:event-1@dora");
    expect(ics).toContain("STATUS:CANCELLED");
    // Commas are escaped in text values.
    expect(ics).toContain("SUMMARY:Dora · Salão de festas\\, aniversário");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("is a valid empty calendar without events", () => {
    const ics = buildCalendarFeed("Dora", [], new Date());
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });
});
