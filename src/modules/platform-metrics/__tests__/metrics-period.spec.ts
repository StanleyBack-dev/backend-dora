import {
  granularityFor,
  isCalendarDate,
  MetricsGranularity,
  nextDate,
  resolvePeriod,
} from "@/modules/platform-metrics/domain/metrics-period";

const TODAY = "2026-11-14";

describe("metrics period", () => {
  it("defaults to the last 30 days ending today", () => {
    expect(resolvePeriod({}, TODAY)).toEqual({
      from: "2026-10-16",
      to: TODAY,
      days: 30,
      granularity: MetricsGranularity.DAY,
    });
  });

  it("keeps the dates asked, counting both ends", () => {
    expect(
      resolvePeriod({ from: "2026-11-01", to: "2026-11-01" }, TODAY),
    ).toMatchObject({ days: 1 });
    expect(
      resolvePeriod({ from: "2025-11-15", to: TODAY }, TODAY),
    ).toMatchObject({ days: 365, granularity: MetricsGranularity.MONTH });
  });

  it("rejects invalid, reversed, future or too long periods", () => {
    expect(resolvePeriod({ from: "2026-02-30", to: TODAY }, TODAY)).toBeNull();
    expect(resolvePeriod({ from: "14/11/2026" }, TODAY)).toBeNull();
    expect(resolvePeriod({ from: TODAY, to: "2026-11-01" }, TODAY)).toBeNull();
    expect(resolvePeriod({ to: "2026-11-15" }, TODAY)).toBeNull();
    expect(resolvePeriod({ from: "2025-01-01", to: TODAY }, TODAY)).toBeNull();
  });

  it("groups by day, week or month by length", () => {
    expect(granularityFor(31)).toBe(MetricsGranularity.DAY);
    expect(granularityFor(32)).toBe(MetricsGranularity.WEEK);
    expect(granularityFor(120)).toBe(MetricsGranularity.WEEK);
    expect(granularityFor(121)).toBe(MetricsGranularity.MONTH);
  });

  it("knows calendar dates and the next day", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(nextDate("2026-12-31")).toBe("2027-01-01");
  });
});
