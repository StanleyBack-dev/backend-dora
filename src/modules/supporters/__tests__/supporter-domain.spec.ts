import {
  MAX_CONTRIBUTION_CENTS,
  normalizeContribution,
  normalizeSupporterName,
  rankSupporters,
  type RankingRow,
} from "@/modules/supporters/domain/supporter";

const TODAY = "2026-11-15";

const valid = {
  name: "  Maria   da Silva ",
  showName: true,
  amountCents: 2500,
  receivedOn: "2026-11-10",
  note: "  via Pix  ",
};

describe("normalizeSupporterName", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeSupporterName("  Ana   Paula ")).toBe("Ana Paula");
  });

  it("refuses names too short or too long", () => {
    expect(normalizeSupporterName(" A ")).toBeNull();
    expect(normalizeSupporterName("x".repeat(61))).toBeNull();
  });
});

describe("normalizeContribution", () => {
  it("returns the cleaned data", () => {
    expect(normalizeContribution(valid, TODAY)).toEqual({
      name: "Maria da Silva",
      showName: true,
      amountCents: 2500,
      receivedOn: "2026-11-10",
      note: "via Pix",
    });
  });

  it("turns an empty note into null", () => {
    const data = normalizeContribution({ ...valid, note: "   " }, TODAY);
    expect(typeof data === "object" && data.note).toBeNull();
  });

  it.each([0, -1, 1.5, MAX_CONTRIBUTION_CENTS + 1])(
    "refuses the amount %s",
    (amountCents) => {
      expect(normalizeContribution({ ...valid, amountCents }, TODAY)).toBe(
        "amount",
      );
    },
  );

  it("refuses dates that don't exist and future dates", () => {
    expect(
      normalizeContribution({ ...valid, receivedOn: "2026-02-30" }, TODAY),
    ).toBe("date");
    expect(
      normalizeContribution({ ...valid, receivedOn: "2026-11-16" }, TODAY),
    ).toBe("future-date");
  });

  it("accepts today", () => {
    expect(
      typeof normalizeContribution({ ...valid, receivedOn: TODAY }, TODAY),
    ).toBe("object");
  });

  it("refuses a long note", () => {
    expect(
      normalizeContribution({ ...valid, note: "x".repeat(201) }, TODAY),
    ).toBe("note");
  });
});

describe("rankSupporters", () => {
  const row = (
    supporterId: string,
    totalCents: number,
    firstReceivedOn: string,
    showName = true,
  ): RankingRow => ({
    supporterId,
    name: `Pessoa ${supporterId}`,
    showName,
    totalCents,
    contributions: 1,
    firstReceivedOn,
  });

  it("orders by total, the earliest first on a tie, sharing the position", () => {
    const entries = rankSupporters([
      row("a", 1000, "2026-03-01"),
      row("b", 5000, "2026-05-01"),
      row("c", 1000, "2026-01-01"),
      row("d", 500, "2026-01-01"),
    ]);
    expect(entries.map((entry) => [entry.position, entry.name])).toEqual([
      [1, "Pessoa b"],
      [2, "Pessoa c"],
      [2, "Pessoa a"],
      [4, "Pessoa d"],
    ]);
  });

  it("hides the name of who chose so", () => {
    const [entry] = rankSupporters([row("a", 1000, "2026-01-01", false)]);
    expect(entry.name).toBeNull();
    expect(entry.totalCents).toBe(1000);
  });

  it("leaves out empty totals and cuts at the size", () => {
    const entries = rankSupporters(
      [
        row("a", 0, "2026-01-01"),
        row("b", 300, "2026-01-01"),
        row("c", 200, "2026-01-01"),
        row("d", 100, "2026-01-01"),
      ],
      2,
    );
    expect(entries.map((entry) => entry.name)).toEqual([
      "Pessoa b",
      "Pessoa c",
    ]);
  });
});
