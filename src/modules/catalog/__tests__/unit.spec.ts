import { formatQuantity, unitFor } from "@/modules/catalog/domain/unit";

describe("unitFor", () => {
  it("puts words in the plural and leaves abbreviations as typed", () => {
    expect(unitFor(4, "rolo")).toBe("rolos");
    expect(unitFor(2, "galão")).toBe("galões");
    expect(unitFor(3, "mês")).toBe("meses");
    expect(unitFor(2, "par")).toBe("pares");
    expect(unitFor(5, "hora")).toBe("horas");
    expect(unitFor(4, "un")).toBe("un");
    expect(unitFor(2, "L")).toBe("L");
    expect(unitFor(2, "m²")).toBe("m²");
    expect(unitFor(1, "rolo")).toBe("rolo");
    expect(unitFor(0.5, "saco")).toBe("saco");
    expect(unitFor(0, "rolo")).toBe("rolos");
  });

  it("formats the quantity in pt-BR", () => {
    expect(formatQuantity(1.5, "saco")).toBe("1,5 sacos");
  });
});
