import { DocumentType } from "@/shared/domain/identity-document";
import {
  feeForBooking,
  isMonth,
  monthDates,
} from "@/modules/bookings/domain/booking-fee";
import {
  checkInDenial,
  guestCode,
  GUEST_CODE_ALPHABET,
  normalizeGuest,
  normalizeGuestCode,
} from "@/modules/bookings/domain/booking-guest";
import {
  isSeriesLength,
  weeklyStarts,
} from "@/modules/bookings/domain/booking-series";

const TZ = "America/Sao_Paulo";

describe("booking guests", () => {
  it("normalizes a guest and checks the document rule", () => {
    expect(
      normalizeGuest(
        {
          name: "  Ana   Souza ",
          documentType: DocumentType.CPF,
          document: " 529.982.247-25 ",
          phone: "(62) 99999-1234",
        },
        true,
      ),
    ).toEqual({
      name: "Ana Souza",
      documentType: DocumentType.CPF,
      document: "52998224725",
      phone: "62999991234",
    });
    expect(
      normalizeGuest(
        {
          name: "Ana",
          documentType: DocumentType.RG,
          document: "12.345.678-x",
        },
        true,
      ),
    ).toMatchObject({ documentType: DocumentType.RG, document: "12345678X" });
    expect(normalizeGuest({ name: "Ana Souza" }, false)).toEqual({
      name: "Ana Souza",
      documentType: null,
      document: null,
      phone: null,
    });
    expect(normalizeGuest({ name: "Ana Souza" }, true)).toBe(
      "document-required",
    );
    expect(normalizeGuest({ name: "A" }, false)).toBe("name");
    expect(normalizeGuest({ name: "Ana", phone: "123" }, false)).toBe("phone");
    // A document needs its type, and each type its own rule.
    expect(
      normalizeGuest({ name: "Ana", document: "52998224725" }, false),
    ).toBe("document-type");
    expect(
      normalizeGuest(
        {
          name: "Ana",
          documentType: DocumentType.CPF,
          document: "529.982.247-24",
        },
        false,
      ),
    ).toBe("cpf");
    expect(
      normalizeGuest(
        { name: "Ana", documentType: DocumentType.RG, document: "abc12345" },
        false,
      ),
    ).toBe("rg");
  });

  it("makes readable codes and accepts them as typed", () => {
    let i = 0;
    const code = guestCode(() => i++ % GUEST_CODE_ALPHABET.length);
    expect(code).toBe("ABCDEFGH");
    expect(normalizeGuestCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizeGuestCode("ABCDEFG0")).toBeNull();
    expect(normalizeGuestCode("ABC")).toBeNull();
  });

  it("lets guests in from 3 hours before until the end", () => {
    const booking = {
      startsAt: new Date("2026-11-20T22:00:00Z"),
      endsAt: new Date("2026-11-21T02:00:00Z"),
      active: true,
    };
    expect(checkInDenial(booking, new Date("2026-11-20T18:59:00Z"))).toBe(
      "too-early",
    );
    expect(checkInDenial(booking, new Date("2026-11-20T19:00:00Z"))).toBeNull();
    expect(checkInDenial(booking, new Date("2026-11-21T02:00:00Z"))).toBe(
      "finished",
    );
    expect(
      checkInDenial(
        { ...booking, active: false },
        new Date("2026-11-20T23:00:00Z"),
      ),
    ).toBe("not-active");
  });
});

describe("booking series", () => {
  it("repeats the same local time every week", () => {
    const starts = weeklyStarts(new Date("2026-11-17T22:00:00Z"), 3, TZ);
    expect(starts.map((date) => date.toISOString())).toEqual([
      "2026-11-17T22:00:00.000Z",
      "2026-11-24T22:00:00.000Z",
      "2026-12-01T22:00:00.000Z",
    ]);
  });

  it("accepts 2 to 26 weeks", () => {
    expect(isSeriesLength(1)).toBe(false);
    expect(isSeriesLength(2)).toBe(true);
    expect(isSeriesLength(26)).toBe(true);
    expect(isSeriesLength(27)).toBe(false);
    expect(isSeriesLength(2.5)).toBe(false);
  });
});

describe("booking fees", () => {
  it("charges only bookings of a unit in paid spaces", () => {
    expect(feeForBooking(5000, "unit")).toBe(5000);
    expect(feeForBooking(5000, null)).toBeNull();
    expect(feeForBooking(null, "unit")).toBeNull();
  });

  it("knows a month's first day and the next", () => {
    expect(monthDates("2026-12")).toEqual({
      first: "2026-12-01",
      next: "2027-01-01",
    });
    expect(monthDates("2026-02")).toEqual({
      first: "2026-02-01",
      next: "2026-03-01",
    });
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-11")).toBe(true);
  });
});
