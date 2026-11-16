import { isPdf } from "@/shared/application/document-file";
import { EventStatus, normalizeEvent } from "@/modules/events/domain/event";
import {
  AttendeeSource,
  EventOrderStatus,
  HOLDING_STATUSES,
  normalizeAttendees,
  normalizeRejectReason,
  orderCode,
  orderTotal,
  paymentDeadline,
  type OrderContext,
} from "@/modules/events/domain/event-order";
import {
  EventPixSource,
  fitsAge,
  formatCents,
  needsProof,
  normalizeTicketing,
  priceOf,
  TicketKind,
  TicketPriceMode,
  type TicketType,
} from "@/modules/events/domain/event-tickets";
import { ageOn, normalizeBirthDate } from "@/shared/domain/birth-date";
import {
  crc16,
  normalizePixKey,
  normalizePixReceiver,
  PixKeyType,
  pixPayload,
} from "@/shared/domain/pix";

const NOW = new Date("2026-11-16T12:00:00Z");
const PIX = {
  keyType: PixKeyType.EMAIL,
  key: "financeiro@condominio.com.br",
  name: "Cond Jardins",
  city: "Goiânia",
};

const type = (
  id: string,
  kind: TicketKind,
  priceMode: TicketPriceMode,
  minAge: number | null,
  maxAge: number | null,
  customPriceCents: number | null = null,
): TicketType => ({
  id,
  kind,
  name: kind,
  priceMode,
  customPriceCents,
  priceCents: priceOf({ priceMode, customPriceCents }, 5000),
  minAge,
  maxAge,
});

const TYPES: TicketType[] = [
  type("adult", TicketKind.ADULT, TicketPriceMode.FULL, 13, 59),
  type("kid", TicketKind.CHILD, TicketPriceMode.HALF, 6, 12),
  type("baby", TicketKind.INFANT, TicketPriceMode.FREE, 0, 5),
  type("senior", TicketKind.SENIOR, TicketPriceMode.CUSTOM, 60, null, 1000),
  type("student", TicketKind.STUDENT, TicketPriceMode.HALF, null, null),
];

const CONTEXT: OrderContext = {
  ticketTypes: TYPES,
  ticketed: true,
  fullPriceCents: 5000,
  eventDay: "2026-12-20",
  self: { name: "Ana Souza", birthDate: "1990-12-21" },
  dependents: new Map([
    ["dep-1", { name: "Bia Souza", birthDate: "2018-01-10" }],
  ]),
};

describe("PIX", () => {
  it("checks each key by its type", () => {
    const { CPF, CNPJ, PHONE, EMAIL, RANDOM } = PixKeyType;
    expect(normalizePixKey(EMAIL, " Fin@Cond.COM ")).toBe("fin@cond.com");
    expect(normalizePixKey(EMAIL, "a@b")).toBeNull();
    expect(normalizePixKey(CPF, "529.982.247-25")).toBe("52998224725");
    expect(normalizePixKey(CPF, "529.982.247-26")).toBeNull();
    expect(normalizePixKey(CPF, "111.111.111-11")).toBeNull();
    expect(normalizePixKey(CNPJ, "11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizePixKey(CNPJ, "11.222.333/0001-82")).toBeNull();
    expect(normalizePixKey(PHONE, "(62) 98460-7820")).toBe("+5562984607820");
    expect(normalizePixKey(PHONE, "+55 62 98460-7820")).toBe("+5562984607820");
    // Landline, missing 9 or DDD: not a PIX phone key.
    expect(normalizePixKey(PHONE, "(62) 3333-0000")).toBeNull();
    expect(normalizePixKey(PHONE, "98460-7820")).toBeNull();
    expect(
      normalizePixKey(RANDOM, "123E4567-E89B-12D3-A456-426614174000"),
    ).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(normalizePixKey(RANDOM, "123e4567")).toBeNull();
    // A CPF typed under another type is refused, never guessed.
    expect(normalizePixKey(PHONE, "529.982.247-25")).toBeNull();
    expect(normalizePixKey(EMAIL, "52998224725")).toBeNull();
  });

  it("checks the receiver and puts name and city in BR Code form", () => {
    expect(normalizePixReceiver(PIX)).toEqual({
      keyType: PixKeyType.EMAIL,
      key: "financeiro@condominio.com.br",
      name: "COND JARDINS",
      city: "GOIANIA",
    });
    expect(normalizePixReceiver({ ...PIX, key: "x" })).toBe("key-email");
    expect(
      normalizePixReceiver({ ...PIX, keyType: PixKeyType.CPF, key: "123" }),
    ).toBe("key-cpf");
    expect(normalizePixReceiver({ ...PIX, name: " " })).toBe("name");
    expect(normalizePixReceiver({ ...PIX, city: "" })).toBe("city");
  });

  it("builds a code with the amount, the reference and a valid CRC", () => {
    const receiver = normalizePixReceiver(PIX);
    if (typeof receiver === "string") throw new Error("unexpected");
    const code = pixPayload(receiver, 12550, "EV7K2QMX");
    expect(code.startsWith("000201")).toBe(true);
    expect(code).toContain("0014br.gov.bcb.pix");
    expect(code).toContain("5406125.50");
    expect(code).toContain("5303986");
    expect(code).toContain("6212" + "0508EV7K2QMX");
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });

  it("matches the CRC16-CCITT check value", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("ticketing", () => {
  it("clears everything on a free event", () => {
    expect(
      normalizeTicketing(false, {
        fullPriceCents: 5000,
        ticketTypes: [
          { kind: TicketKind.ADULT, priceMode: TicketPriceMode.FULL },
        ],
        pixSource: EventPixSource.CONDOMINIUM,
      }),
    ).toEqual({
      fullPriceCents: null,
      ticketTypes: [],
      unitTicketLimit: null,
      pixSource: null,
      customPix: null,
    });
  });

  it("checks the full price, the audiences and the PIX", () => {
    const base = {
      fullPriceCents: 5000,
      ticketTypes: [
        { kind: TicketKind.ADULT, priceMode: TicketPriceMode.FULL },
      ],
      pixSource: EventPixSource.CONDOMINIUM,
    };
    expect(normalizeTicketing(true, base)).toMatchObject({
      fullPriceCents: 5000,
      ticketTypes: [
        {
          id: null,
          kind: TicketKind.ADULT,
          priceMode: TicketPriceMode.FULL,
          customPriceCents: null,
        },
      ],
    });
    expect(normalizeTicketing(true, { ...base, fullPriceCents: 0 })).toBe(
      "full-price",
    );
    expect(normalizeTicketing(true, { ...base, ticketTypes: [] })).toBe(
      "types-missing",
    );
    expect(
      normalizeTicketing(true, {
        ...base,
        ticketTypes: [
          { kind: TicketKind.ADULT, priceMode: TicketPriceMode.FULL },
          { kind: TicketKind.ADULT, priceMode: TicketPriceMode.HALF },
        ],
      }),
    ).toBe("type-duplicate");
    expect(
      normalizeTicketing(true, {
        ...base,
        ticketTypes: [
          { kind: TicketKind.ADULT, priceMode: TicketPriceMode.CUSTOM },
        ],
      }),
    ).toBe("type-price");
    expect(
      normalizeTicketing(true, {
        ...base,
        ticketTypes: [
          {
            kind: TicketKind.CHILD,
            priceMode: TicketPriceMode.HALF,
            minAge: 12,
            maxAge: 6,
          },
        ],
      }),
    ).toBe("type-ages");
    expect(
      normalizeTicketing(true, {
        ...base,
        ticketTypes: [
          { kind: "VIP" as TicketKind, priceMode: TicketPriceMode.FULL },
        ],
      }),
    ).toBe("type-kind");
    expect(normalizeTicketing(true, { ...base, unitTicketLimit: 0 })).toBe(
      "unit-limit",
    );
    expect(normalizeTicketing(true, { ...base, pixSource: null })).toBe(
      "pix-source",
    );
    expect(
      normalizeTicketing(true, {
        ...base,
        pixSource: EventPixSource.CUSTOM,
        customPix: { ...PIX, key: "nope" },
      }),
    ).toBe("key-email");
  });

  it("prices each audience from the full price", () => {
    const at = (priceMode: TicketPriceMode, custom: number | null = null) =>
      priceOf({ priceMode, customPriceCents: custom }, 5001);
    expect(at(TicketPriceMode.FULL)).toBe(5001);
    expect(at(TicketPriceMode.HALF)).toBe(2501);
    expect(at(TicketPriceMode.FREE)).toBe(0);
    expect(at(TicketPriceMode.CUSTOM, 3000)).toBe(3000);
  });

  it("asks a document for a condition, or a discount by an unknown age", () => {
    const [adult, kid, , , student] = TYPES;
    expect(needsProof(adult, 5000, 5000, false)).toBe(false);
    expect(needsProof(kid, 2500, 5000, true)).toBe(false);
    expect(needsProof(kid, 2500, 5000, false)).toBe(true);
    expect(needsProof(student, 2500, 5000, true)).toBe(true);
    // A student paying the full price proves nothing.
    expect(needsProof(student, 5000, 5000, true)).toBe(false);
  });

  it("is part of the event's checks", () => {
    const event = {
      title: "Festa",
      spaceId: "space",
      startsAt: new Date("2026-12-20T22:00:00Z"),
      endsAt: new Date("2026-12-21T02:00:00Z"),
      capacity: 100,
      externalGuestLimit: 10,
      ticketed: true,
    };
    expect(normalizeEvent(event, NOW)).toBe("full-price");
    expect(
      normalizeEvent(
        {
          ...event,
          fullPriceCents: 5000,
          ticketTypes: [
            { kind: TicketKind.ADULT, priceMode: TicketPriceMode.FULL },
          ],
          pixSource: EventPixSource.CONDOMINIUM,
        },
        NOW,
      ),
    ).toMatchObject({ ticketed: true, fullPriceCents: 5000 });
    expect(EventStatus.PUBLISHED).toBe("PUBLISHED");
  });

  it("matches ages to types and formats prices", () => {
    expect(fitsAge(TYPES[1], 6)).toBe(true);
    expect(fitsAge(TYPES[1], 13)).toBe(false);
    expect(fitsAge(TYPES[4], 90)).toBe(true);
    expect(formatCents(12550)).toMatch(/R\$\s125,50/);
  });
});

describe("birth dates", () => {
  it("accepts real dates up to today and counts whole years", () => {
    expect(normalizeBirthDate("2000-02-29", "2026-11-16")).toBe("2000-02-29");
    expect(normalizeBirthDate("2001-02-29", "2026-11-16")).toBeNull();
    expect(normalizeBirthDate("2026-11-17", "2026-11-16")).toBeNull();
    expect(normalizeBirthDate("1899-12-31", "2026-11-16")).toBeNull();
    expect(ageOn("1990-12-21", "2026-12-20")).toBe(35);
    expect(ageOn("1990-12-20", "2026-12-20")).toBe(36);
  });
});

describe("orders", () => {
  it("takes the buyer's and the dependent's ages from their birth dates", () => {
    const people = normalizeAttendees(
      [
        { source: AttendeeSource.SELF, outside: true, ticketTypeId: "adult" },
        {
          source: AttendeeSource.DEPENDENT,
          dependentId: "dep-1",
          outside: true,
          ticketTypeId: "kid",
        },
      ],
      CONTEXT,
    );
    if (typeof people === "string") throw new Error(people);
    expect(
      people.map((p) => [p.name, p.age, p.outside, p.priceCents, p.needsProof]),
    ).toEqual([
      // 35 the day before the 36th birthday; members are never "outside".
      ["Ana Souza", 35, false, 5000, false],
      ["Bia Souza", 8, false, 2500, false],
    ]);
  });

  it("asks a guest's document for a discount by age", () => {
    const people = normalizeAttendees(
      [
        {
          source: AttendeeSource.GUEST,
          name: " Caio  Lima ",
          age: 8,
          outside: true,
          ticketTypeId: "kid",
        },
        {
          source: AttendeeSource.GUEST,
          name: "Rui Lima",
          age: 40,
          outside: true,
          ticketTypeId: "adult",
        },
        {
          source: AttendeeSource.GUEST,
          name: "Eva Lima",
          age: 3,
          outside: false,
          ticketTypeId: "baby",
        },
      ],
      CONTEXT,
    );
    if (typeof people === "string") throw new Error(people);
    expect(people.map((p) => [p.name, p.priceCents, p.needsProof])).toEqual([
      ["Caio Lima", 2500, true],
      ["Rui Lima", 5000, false],
      ["Eva Lima", 0, true],
    ]);
    expect(orderTotal(people)).toBe(7500);
  });

  it("asks a student's document even for the buyer", () => {
    const people = normalizeAttendees(
      [
        {
          source: AttendeeSource.SELF,
          outside: false,
          ticketTypeId: "student",
        },
      ],
      CONTEXT,
    );
    if (typeof people === "string") throw new Error(people);
    expect(people[0]).toMatchObject({ priceCents: 2500, needsProof: true });
  });

  it("refuses wrong people", () => {
    const guest = (patch: object) =>
      normalizeAttendees(
        [
          {
            source: AttendeeSource.GUEST,
            name: "Ana Souza",
            age: 30,
            outside: false,
            ticketTypeId: "adult",
            ...patch,
          },
        ],
        CONTEXT,
      );
    expect(normalizeAttendees([], CONTEXT)).toBe("empty");
    expect(guest({ name: "An" })).toBe("name");
    expect(guest({ age: null })).toBe("age");
    expect(guest({ ticketTypeId: null })).toBe("type-missing");
    expect(guest({ ticketTypeId: "other" })).toBe("type-unknown");
    expect(guest({ ticketTypeId: "kid" })).toBe("type-age");
    const self = {
      source: AttendeeSource.SELF,
      outside: false,
      ticketTypeId: "adult",
    };
    expect(normalizeAttendees([self, self], CONTEXT)).toBe("self-twice");
    expect(normalizeAttendees([self], { ...CONTEXT, self: null })).toBe(
      "self-unknown",
    );
    expect(
      normalizeAttendees(
        [
          {
            source: AttendeeSource.DEPENDENT,
            dependentId: "nope",
            outside: false,
            ticketTypeId: "kid",
          },
        ],
        CONTEXT,
      ),
    ).toBe("dependent-unknown");
  });

  it("takes no ticket on a free event", () => {
    const people = normalizeAttendees(
      [
        {
          source: AttendeeSource.GUEST,
          name: "Ana Souza",
          age: 30,
          outside: true,
        },
      ],
      { ...CONTEXT, ticketed: false, ticketTypes: [], fullPriceCents: 0 },
    );
    expect(people).toEqual([
      expect.objectContaining({
        name: "Ana Souza",
        ticketTypeId: null,
        priceCents: 0,
        needsProof: false,
      }),
    ]);
  });

  it("holds pending places for 48 h, never past the start", () => {
    expect(paymentDeadline(NOW, new Date("2026-12-01T00:00:00Z"))).toEqual(
      new Date("2026-11-18T12:00:00Z"),
    );
    expect(paymentDeadline(NOW, new Date("2026-11-17T00:00:00Z"))).toEqual(
      new Date("2026-11-17T00:00:00Z"),
    );
    expect(HOLDING_STATUSES).not.toContain(EventOrderStatus.EXPIRED);
  });

  it("makes readable codes and checks reasons and PDFs", () => {
    let i = 0;
    const code = orderCode(() => i++ % 31);
    expect(code).toMatch(/^EV[2-9A-HJKMNP-Z]{6}$/);
    expect(normalizeRejectReason("  valor  errado ")).toBe("valor errado");
    expect(normalizeRejectReason("ok")).toBeNull();
    expect(isPdf(Buffer.from("%PDF-1.7 ..."))).toBe(true);
    expect(isPdf(Buffer.from("\x89PNG"))).toBe(false);
  });
});
