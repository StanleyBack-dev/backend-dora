import { EventStatus } from "@/modules/events/domain/event";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import {
  entryDenial,
  entryOpensAt,
  normalizeTicketCode,
  TICKET_CODE_LENGTH,
  ticketCode,
  TicketPassStatus,
  ticketPassStatus,
} from "@/modules/events/domain/event-ticket-entry";

const NOW = new Date("2026-11-20T20:00:00Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const ticket = (patch: Partial<Parameters<typeof entryDenial>[0]> = {}) => ({
  eventStatus: EventStatus.PUBLISHED,
  orderStatus: EventOrderStatus.CONFIRMED,
  startsAt: hours(1),
  endsAt: hours(5),
  ...patch,
});

describe("event tickets at the gate", () => {
  it("draws 10-character codes from the order alphabet", () => {
    let i = 0;
    const code = ticketCode(() => i++ % 31);
    expect(code).toHaveLength(TICKET_CODE_LENGTH);
    expect(code).toBe("23456789AB");
  });

  it("reads a typed or scanned code", () => {
    expect(normalizeTicketCode("abcde fghjk")).toBe("ABCDEFGHJK");
    expect(normalizeTicketCode("ABCDE·FGHJK")).toBe("ABCDEFGHJK");
    expect(normalizeTicketCode("ABCDE-FGHJK")).toBe("ABCDEFGHJK");
    // A booking guest's invite (8), a letter outside the alphabet (O, I, 0).
    expect(normalizeTicketCode("ABCDEFGH")).toBeNull();
    expect(normalizeTicketCode("ABCDEFGHJO")).toBeNull();
    expect(normalizeTicketCode("ABCDEFGHJ0")).toBeNull();
  });

  it("lets a confirmed ticket in from 3 hours before until the end", () => {
    expect(entryDenial(ticket(), NOW)).toBeNull();
    expect(entryDenial(ticket({ startsAt: hours(3) }), NOW)).toBeNull();
    expect(entryDenial(ticket({ startsAt: hours(3.5) }), NOW)).toBe(
      "too-early",
    );
    expect(entryOpensAt(hours(3.5)).getTime()).toBe(hours(0.5).getTime());
    expect(
      entryDenial(ticket({ startsAt: hours(-4), endsAt: hours(0) }), NOW),
    ).toBe("finished");
  });

  it("refuses unconfirmed orders and cancelled events", () => {
    for (const orderStatus of [
      EventOrderStatus.PENDING_PAYMENT,
      EventOrderStatus.AWAITING_REVIEW,
      EventOrderStatus.REJECTED,
      EventOrderStatus.CANCELLED,
    ]) {
      expect(entryDenial(ticket({ orderStatus }), NOW)).toBe("not-valid");
    }
    expect(
      entryDenial(ticket({ eventStatus: EventStatus.CANCELLED }), NOW),
    ).toBe("not-valid");
  });

  it("tells the ticket page whether it still works", () => {
    expect(ticketPassStatus(ticket(), NOW)).toBe(TicketPassStatus.VALID);
    expect(
      ticketPassStatus(ticket({ eventStatus: EventStatus.CANCELLED }), NOW),
    ).toBe(TicketPassStatus.CANCELLED);
    expect(ticketPassStatus(ticket({ endsAt: hours(-1) }), NOW)).toBe(
      TicketPassStatus.ENDED,
    );
  });
});
