import { publishedNotices } from "@/modules/events/application/event-notices";
import type { EventView } from "@/modules/events/application/ports/event-repository.port";
import {
  EventPixSource,
  TicketKind,
  TicketPriceMode,
} from "@/modules/events/domain/event-tickets";
import {
  EVENT_MAX_DAYS,
  EventSalesClose,
  EventStatus,
  isOnSale,
  isOpen,
  salesClosesAt,
  normalizeCancelReason,
  normalizeEvent,
  type EventInput,
} from "@/modules/events/domain/event";
import {
  formatAddress,
  normalizeAddress,
} from "@/shared/domain/brazilian-address";

const NOW = new Date("2026-11-16T12:00:00Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const inSpace: EventInput = {
  title: "  Festa   de Fim de Ano ",
  description: "  Música e comida.  ",
  spaceId: "space-1",
  location: " área  coberta ",
  address: null,
  startsAt: hours(24),
  endsAt: hours(30),
  capacity: 200,
  externalGuestLimit: 50,
  ticketed: true,
  fullPriceCents: 5000,
  ticketTypes: [{ kind: TicketKind.ADULT, priceMode: TicketPriceMode.FULL }],
  pixSource: EventPixSource.CONDOMINIUM,
};

const address = {
  zip: "74.000-100",
  street: "  Rua das   Palmeiras ",
  number: "120",
  complement: null,
  district: "Setor Sul",
  city: "Goiânia",
  state: "go",
};

const outside: EventInput = {
  ...inSpace,
  spaceId: null,
  location: "Chácara Bela Vista",
  address,
};

describe("normalizeEvent", () => {
  it("trims the text and keeps the rest (in a space)", () => {
    expect(normalizeEvent(inSpace, NOW)).toEqual({
      title: "Festa de Fim de Ano",
      description: "Música e comida.",
      spaceId: "space-1",
      location: "área coberta",
      address: null,
      startsAt: inSpace.startsAt,
      endsAt: inSpace.endsAt,
      capacity: 200,
      externalGuestLimit: 50,
      ticketed: true,
      fullPriceCents: 5000,
      ticketTypes: [
        {
          id: null,
          kind: TicketKind.ADULT,
          priceMode: TicketPriceMode.FULL,
          customPriceCents: null,
          minAge: null,
          maxAge: null,
        },
      ],
      unitTicketLimit: null,
      pixSource: EventPixSource.CONDOMINIUM,
      customPix: null,
      salesClose: EventSalesClose.BEFORE_START,
      salesCloseHours: 0,
    });
  });

  it("closes sales some hours before the start, or at the end", () => {
    const before = normalizeEvent(
      {
        ...inSpace,
        salesClose: EventSalesClose.BEFORE_START,
        salesCloseHours: 24,
      },
      NOW,
    );
    if (typeof before === "string") throw new Error(before);
    expect(before.salesCloseHours).toBe(24);
    const at = (data: typeof before) => salesClosesAt(data).toISOString();
    expect(at(before)).toBe("2026-11-16T12:00:00.000Z");
    // At the end: the hours don't count.
    const end = normalizeEvent(
      { ...inSpace, salesClose: EventSalesClose.AT_END, salesCloseHours: 5 },
      NOW,
    );
    if (typeof end === "string") throw new Error(end);
    expect(end.salesCloseHours).toBe(0);
    expect(at(end)).toBe(inSpace.endsAt.toISOString());
    for (const salesCloseHours of [-1, 1.5, 721]) {
      expect(normalizeEvent({ ...inSpace, salesCloseHours }, NOW)).toBe(
        "sales-close",
      );
    }
  });

  it("takes orders while published and before the sales close", () => {
    const event = {
      status: EventStatus.PUBLISHED,
      startsAt: hours(10),
      endsAt: hours(14),
      salesClose: EventSalesClose.BEFORE_START,
      salesCloseHours: 0,
    };
    expect(isOnSale(event, NOW)).toBe(true);
    expect(isOnSale({ ...event, salesCloseHours: 10 }, NOW)).toBe(false);
    expect(isOnSale({ ...event, salesCloseHours: 9 }, NOW)).toBe(true);
    expect(isOnSale({ ...event, status: EventStatus.CANCELLED }, NOW)).toBe(
      false,
    );
    // At the end: also during the event, until it ends.
    const during = {
      ...event,
      startsAt: hours(-1),
      salesClose: EventSalesClose.AT_END,
    };
    expect(isOnSale(during, NOW)).toBe(true);
    expect(
      isOnSale({ ...during, salesClose: EventSalesClose.BEFORE_START }, NOW),
    ).toBe(false);
    expect(isOnSale({ ...during, endsAt: hours(0) }, NOW)).toBe(false);
  });

  it("ignores an address sent with a space", () => {
    const data = normalizeEvent({ ...inSpace, address }, NOW);
    expect(typeof data === "object" && data.address).toBeNull();
  });

  it("needs the full address outside the condominium", () => {
    expect(normalizeEvent({ ...outside, address: null }, NOW)).toBe("place");
    expect(
      normalizeEvent({ ...outside, address: { ...address, zip: "123" } }, NOW),
    ).toBe("zip");
    expect(
      normalizeEvent({ ...outside, address: { ...address, city: "" } }, NOW),
    ).toBe("city");
    const data = normalizeEvent(outside, NOW);
    expect(typeof data === "object" && data.address).toEqual({
      zip: "74000100",
      street: "Rua das Palmeiras",
      number: "120",
      complement: null,
      district: "Setor Sul",
      city: "Goiânia",
      state: "GO",
    });
  });

  it("refuses a bad title or period", () => {
    expect(normalizeEvent({ ...inSpace, title: "ab" }, NOW)).toBe("title");
    expect(normalizeEvent({ ...inSpace, endsAt: inSpace.startsAt }, NOW)).toBe(
      "period",
    );
    expect(
      normalizeEvent(
        { ...inSpace, endsAt: hours(24 + EVENT_MAX_DAYS * 24 + 1) },
        NOW,
      ),
    ).toBe("too-long");
    expect(
      normalizeEvent(
        { ...inSpace, startsAt: hours(-1), endsAt: hours(2) },
        NOW,
      ),
    ).toBe("past");
  });

  it("requires the capacity and guests between 0 and it", () => {
    expect(normalizeEvent({ ...inSpace, capacity: 0 }, NOW)).toBe("capacity");
    expect(normalizeEvent({ ...inSpace, capacity: 1.5 }, NOW)).toBe("capacity");
    expect(normalizeEvent({ ...inSpace, externalGuestLimit: -1 }, NOW)).toBe(
      "guests",
    );
    expect(
      normalizeEvent({ ...inSpace, capacity: 10, externalGuestLimit: 11 }, NOW),
    ).toBe("guests");
    const residentsOnly = normalizeEvent(
      { ...inSpace, externalGuestLimit: 0 },
      NOW,
    );
    expect(
      typeof residentsOnly === "object" && residentsOnly.externalGuestLimit,
    ).toBe(0);
  });
});

describe("normalizeAddress", () => {
  it("takes S/N for a place without a number", () => {
    for (const number of ["s/n", "SN", " S / N "]) {
      const result = normalizeAddress({ ...address, number });
      expect(typeof result === "object" && result.number).toBe("S/N");
    }
    expect(normalizeAddress({ ...address, number: "abc" })).toBe("number");
    expect(normalizeAddress({ ...address, number: "12-A" })).toEqual(
      expect.objectContaining({ number: "12-A" }),
    );
  });

  it("formats it in one line", () => {
    const result = normalizeAddress({ ...address, number: "sn" });
    expect(typeof result === "object" && formatAddress(result)).toBe(
      "Rua das Palmeiras, S/N - Setor Sul, Goiânia/GO, 74000-100",
    );
  });
});

describe("isOpen", () => {
  it("is open until it ends, unless cancelled", () => {
    const event = { status: EventStatus.PUBLISHED, endsAt: hours(1) };
    expect(isOpen(event, NOW)).toBe(true);
    expect(isOpen({ ...event, endsAt: hours(-1) }, NOW)).toBe(false);
    expect(isOpen({ ...event, status: EventStatus.CANCELLED }, NOW)).toBe(
      false,
    );
  });
});

describe("normalizeCancelReason", () => {
  it("needs 3 to 400 characters", () => {
    expect(normalizeCancelReason("  Chuva   forte ")).toBe("Chuva forte");
    expect(normalizeCancelReason("ab")).toBeNull();
    expect(normalizeCancelReason("x".repeat(401))).toBeNull();
  });
});

describe("publishedNotices", () => {
  it("tells each member, with a calendar entry and the address", () => {
    const event = {
      id: "event-1",
      title: "Festa",
      description: null,
      spaceName: null,
      location: "Chácara Bela Vista",
      address: {
        zip: "74000100",
        street: "Rua das Palmeiras",
        number: "S/N",
        complement: null,
        district: "Setor Sul",
        city: "Goiânia",
        state: "GO",
      },
      startsAt: hours(24),
      endsAt: hours(30),
      ticketed: false,
    } as unknown as EventView;
    const drafts = publishedNotices(event, ["u1", "u2"], "America/Sao_Paulo");
    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toEqual(
      expect.objectContaining({
        dedupeKey: "event:event-1:published:u1",
        payload: expect.objectContaining({
          type: "EVENT_PUBLISHED",
          link: "/eventos/event-1",
          body: expect.stringContaining(
            "Chácara Bela Vista · Rua das Palmeiras, S/N - Setor Sul, Goiânia/GO",
          ),
          calendar: expect.objectContaining({ uid: "event-event-1@dora" }),
        }),
      }),
    );
  });
});
