import {
  normalizeSpaceDetails,
  SpaceKind,
} from "@/modules/spaces/domain/space";
import {
  DEFAULT_RULES,
  LimitPeriod,
  minutesOf,
  normalizeSpaceRules,
  type SpaceRules,
} from "@/modules/spaces/domain/space-rules";

const rules = (patch: Partial<SpaceRules> = {}): SpaceRules => ({
  ...DEFAULT_RULES,
  ...patch,
});

describe("space details", () => {
  const base = {
    name: "  Quadra   de tênis ",
    kind: SpaceKind.COURT,
    description: "  Piso sintético \n\n\n\n coberta ",
    capacity: 4,
    usageRules: "",
  };

  it("trims, collapses spaces and empties optional texts", () => {
    expect(normalizeSpaceDetails(base)).toEqual({
      name: "Quadra de tênis",
      kind: SpaceKind.COURT,
      description: "Piso sintético \n\n coberta",
      capacity: 4,
      usageRules: null,
    });
  });

  it("reports the first problem", () => {
    expect(normalizeSpaceDetails({ ...base, name: "Q" })).toBe("name");
    expect(normalizeSpaceDetails({ ...base, capacity: 0 })).toBe("capacity");
    expect(normalizeSpaceDetails({ ...base, capacity: 2.5 })).toBe("capacity");
    expect(
      normalizeSpaceDetails({ ...base, usageRules: "x".repeat(3001) }),
    ).toBe("usage-rules");
  });
});

describe("space rules", () => {
  it("accepts the defaults and sorts the opening hours", () => {
    const result = normalizeSpaceRules(
      rules({
        openingHours: [
          { weekday: 6, opensAt: "09:00", closesAt: "13:00" },
          { weekday: 1, opensAt: "18:00", closesAt: "24:00" },
        ],
      }),
    );
    expect(typeof result).toBe("object");
    expect(
      (result as SpaceRules).openingHours.map((day) => day.weekday),
    ).toEqual([1, 6]);
  });

  it("reads times, with 24:00 as midnight", () => {
    expect(minutesOf("08:30")).toBe(510);
    expect(minutesOf("24:00")).toBe(1440);
    expect(minutesOf("24:30")).toBeNull();
    expect(minutesOf("8:30")).toBeNull();
  });

  it("rejects bad or repeated days and days shorter than a slot", () => {
    expect(
      normalizeSpaceRules(
        rules({
          openingHours: [{ weekday: 1, opensAt: "22:00", closesAt: "08:00" }],
        }),
      ),
    ).toBe("opening-hours");
    expect(
      normalizeSpaceRules(
        rules({
          openingHours: [
            { weekday: 1, opensAt: "08:00", closesAt: "12:00" },
            { weekday: 1, opensAt: "13:00", closesAt: "18:00" },
          ],
        }),
      ),
    ).toBe("opening-hours");
    expect(
      normalizeSpaceRules(
        rules({
          slotMinutes: 240,
          openingHours: [{ weekday: 2, opensAt: "08:00", closesAt: "10:00" }],
        }),
      ),
    ).toBe("opening-hours-slot");
  });

  it("checks slot steps, advance window, limits and cancellation", () => {
    expect(normalizeSpaceRules(rules({ slotMinutes: 50 }))).toBe("slot");
    expect(normalizeSpaceRules(rules({ slotMinutes: 0 }))).toBe("slot");
    expect(
      normalizeSpaceRules(rules({ minAdvanceHours: 48, maxAdvanceDays: 2 })),
    ).toBe("max-advance");
    expect(normalizeSpaceRules(rules({ maxAdvanceDays: 400 }))).toBe(
      "max-advance",
    );
    expect(
      normalizeSpaceRules(
        rules({ unitLimit: { count: 0, period: LimitPeriod.WEEK } }),
      ),
    ).toBe("unit-limit");
    expect(normalizeSpaceRules(rules({ cancelUntilHours: -1 }))).toBe("cancel");
  });

  it("allows a space closed every day (no opening hours)", () => {
    expect(normalizeSpaceRules(rules({ openingHours: [] }))).toEqual(
      expect.objectContaining({ openingHours: [] }),
    );
  });
});
