import { BookingStatus, checkCancel } from "@/modules/bookings/domain/booking";
import {
  bookingWindow,
  checkSlot,
  limitRange,
  slotsOfDay,
  weekdayOf,
} from "@/modules/bookings/domain/booking-slots";
import { checkBlock, overlaps } from "@/modules/bookings/domain/space-block";
import {
  DEFAULT_RULES,
  LimitPeriod,
  type SpaceRules,
} from "@/modules/spaces/domain/space-rules";

// São Paulo is UTC-3 all year (no daylight saving since 2019).
const TZ = "America/Sao_Paulo";
const at = (local: string) => new Date(`${local}-03:00`);

const rules = (patch: Partial<SpaceRules> = {}): SpaceRules => ({
  ...DEFAULT_RULES,
  openingHours: [
    // 2026-11-16 is a Monday.
    { weekday: 1, opensAt: "08:00", closesAt: "11:30" },
    { weekday: 6, opensAt: "18:00", closesAt: "24:00" },
  ],
  slotMinutes: 60,
  ...patch,
});

describe("slots of a day", () => {
  it("knows the weekday of a date", () => {
    expect(weekdayOf("2026-11-16")).toBe(1);
    expect(weekdayOf("2026-11-15")).toBe(0);
  });

  it("fills the opening hours with whole slots only", () => {
    const slots = slotsOfDay("2026-11-16", rules(), TZ);
    expect(slots.map((slot) => slot.startsAt)).toEqual([
      at("2026-11-16T08:00:00"),
      at("2026-11-16T09:00:00"),
      at("2026-11-16T10:00:00"),
    ]);
    expect(slots[2]?.endsAt).toEqual(at("2026-11-16T11:00:00"));
  });

  it("runs until midnight and is empty on closed days", () => {
    const saturday = slotsOfDay("2026-11-21", rules(), TZ);
    expect(saturday).toHaveLength(6);
    expect(saturday[5]?.endsAt).toEqual(at("2026-11-22T00:00:00"));
    expect(slotsOfDay("2026-11-17", rules(), TZ)).toEqual([]);
  });
});

describe("checkSlot", () => {
  const now = at("2026-11-16T07:00:00");

  it("accepts a slot start inside the window", () => {
    expect(checkSlot(at("2026-11-16T09:00:00"), rules(), now, TZ)).toBeNull();
  });

  it("refuses instants that are not a slot start", () => {
    expect(checkSlot(at("2026-11-16T09:30:00"), rules(), now, TZ)).toBe(
      "not-a-slot",
    );
    expect(checkSlot(at("2026-11-17T09:00:00"), rules(), now, TZ)).toBe(
      "not-a-slot",
    );
  });

  it("refuses the past, the minimum advance and beyond the window", () => {
    const later = at("2026-11-16T08:30:00");
    expect(checkSlot(at("2026-11-16T08:00:00"), rules(), later, TZ)).toBe(
      "past",
    );
    expect(
      checkSlot(
        at("2026-11-16T09:00:00"),
        rules({ minAdvanceHours: 3 }),
        now,
        TZ,
      ),
    ).toBe("too-soon");
    expect(
      checkSlot(
        at("2026-11-23T09:00:00"),
        rules({ maxAdvanceDays: 6 }),
        now,
        TZ,
      ),
    ).toBe("too-far");
    expect(
      checkSlot(
        at("2026-11-23T09:00:00"),
        rules({ maxAdvanceDays: 7 }),
        now,
        TZ,
      ),
    ).toBeNull();
  });

  it("opens the calendar from today to today + window", () => {
    expect(bookingWindow({ maxAdvanceDays: 30 }, now, TZ)).toEqual({
      firstDate: "2026-11-16",
      lastDate: "2026-12-16",
    });
  });
});

describe("limitRange", () => {
  const start = at("2026-11-19T10:00:00"); // a Thursday

  it("counts by day, Monday-to-Sunday week, or month", () => {
    expect(limitRange(start, LimitPeriod.DAY, TZ)).toEqual({
      from: at("2026-11-19T00:00:00"),
      to: at("2026-11-20T00:00:00"),
    });
    expect(limitRange(start, LimitPeriod.WEEK, TZ)).toEqual({
      from: at("2026-11-16T00:00:00"),
      to: at("2026-11-23T00:00:00"),
    });
    expect(limitRange(start, LimitPeriod.MONTH, TZ)).toEqual({
      from: at("2026-11-01T00:00:00"),
      to: at("2026-12-01T00:00:00"),
    });
  });

  it("puts Sunday at the end of its week and rolls December over", () => {
    expect(
      limitRange(at("2026-11-22T10:00:00"), LimitPeriod.WEEK, TZ).from,
    ).toEqual(at("2026-11-16T00:00:00"));
    expect(
      limitRange(at("2026-12-31T10:00:00"), LimitPeriod.MONTH, TZ).to,
    ).toEqual(at("2027-01-01T00:00:00"));
  });
});

describe("checkCancel", () => {
  const booking = {
    status: BookingStatus.CONFIRMED,
    endsAt: at("2026-11-20T11:00:00"),
    cancelUntil: at("2026-11-20T06:00:00"),
  };

  it("lets the booker cancel until the deadline", () => {
    expect(checkCancel(booking, at("2026-11-20T05:00:00"), false)).toBeNull();
    expect(checkCancel(booking, at("2026-11-20T07:00:00"), false)).toBe(
      "deadline",
    );
  });

  it("lets a manager cancel until the end", () => {
    expect(checkCancel(booking, at("2026-11-20T10:30:00"), true)).toBeNull();
    expect(checkCancel(booking, at("2026-11-20T11:00:00"), true)).toBe(
      "finished",
    );
  });

  it("refuses bookings that are no longer active", () => {
    expect(
      checkCancel(
        { ...booking, status: BookingStatus.REJECTED },
        at("2026-11-19T10:00:00"),
        true,
      ),
    ).toBe("not-active");
  });
});

describe("blocks", () => {
  const now = at("2026-11-16T07:00:00");
  const base = {
    startsAt: at("2026-11-18T00:00:00"),
    endsAt: at("2026-11-19T00:00:00"),
    reason: "  Pintura   da quadra ",
  };

  it("trims the reason", () => {
    expect(checkBlock(base, now)).toEqual({ reason: "Pintura da quadra" });
  });

  it("refuses inverted, past, too long or unexplained blocks", () => {
    expect(checkBlock({ ...base, endsAt: base.startsAt }, now)).toBe("range");
    expect(
      checkBlock(
        {
          ...base,
          startsAt: at("2026-11-15T08:00:00"),
          endsAt: at("2026-11-16T06:00:00"),
        },
        now,
      ),
    ).toBe("past");
    expect(
      checkBlock({ ...base, endsAt: at("2027-12-31T00:00:00") }, now),
    ).toBe("too-long");
    expect(checkBlock({ ...base, reason: "x" }, now)).toBe("reason");
  });

  it("treats touching periods as not overlapping", () => {
    const morning = {
      startsAt: at("2026-11-18T08:00:00"),
      endsAt: at("2026-11-18T09:00:00"),
    };
    const next = {
      startsAt: at("2026-11-18T09:00:00"),
      endsAt: at("2026-11-18T10:00:00"),
    };
    expect(overlaps(morning, next)).toBe(false);
    expect(overlaps(morning, { ...next, startsAt: morning.startsAt })).toBe(
      true,
    );
  });
});
