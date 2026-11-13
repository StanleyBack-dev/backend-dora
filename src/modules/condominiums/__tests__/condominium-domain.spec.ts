import {
  isValidCnpj,
  normalizeCondominium,
} from "@/modules/condominiums/domain/condominium";
import {
  expandUnitNumbers,
  MAX_UNITS_PER_BATCH,
  normalizeBlock,
  unitKey,
  unitLabel,
} from "@/modules/condominiums/domain/unit";

describe("condominium", () => {
  it("validates the CNPJ check digits", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
  });

  it("normalizes the form (CNPJ optional, digits only, UF uppercase)", () => {
    expect(
      normalizeCondominium({
        name: "  Residencial   Aurora ",
        document: "11.222.333/0001-81",
        city: " Goiânia ",
        state: "go",
      }),
    ).toEqual({
      name: "Residencial Aurora",
      document: "11222333000181",
      city: "Goiânia",
      state: "GO",
    });
    expect(
      normalizeCondominium({ name: "Aurora", city: "Goiânia", state: "GO" }),
    ).toEqual(expect.objectContaining({ document: null }));
  });

  it("reports the first problem", () => {
    const base = { name: "Aurora", city: "Goiânia", state: "GO" };
    expect(normalizeCondominium({ ...base, name: "A" })).toBe("name");
    expect(normalizeCondominium({ ...base, document: "123" })).toBe("document");
    expect(normalizeCondominium({ ...base, city: "" })).toBe("city");
    expect(normalizeCondominium({ ...base, state: "XX" })).toBe("state");
  });
});

describe("units", () => {
  it("labels units with and without block", () => {
    expect(unitLabel({ block: "Bloco A", number: "101" })).toBe(
      "Bloco A · 101",
    );
    expect(unitLabel({ block: "", number: "Casa 3" })).toBe("Casa 3");
  });

  it("treats block and number case-insensitively", () => {
    expect(unitKey({ block: "Bloco A", number: "10B" })).toBe(
      unitKey({ block: "bloco a", number: "10b" }),
    );
  });

  it("accepts an empty block and rejects long ones", () => {
    expect(normalizeBlock(undefined)).toBe("");
    expect(normalizeBlock("  Torre   1 ")).toBe("Torre 1");
    expect(normalizeBlock("x".repeat(31))).toBeNull();
  });

  it("expands ranges and lists, keeping zero padding", () => {
    expect(expandUnitNumbers("101-104, 201")).toEqual([
      "101",
      "102",
      "103",
      "104",
      "201",
    ]);
    expect(expandUnitNumbers("01-03")).toEqual(["01", "02", "03"]);
    expect(expandUnitNumbers("Casa 1; Casa 2\nCasa 1")).toEqual([
      "Casa 1",
      "Casa 2",
    ]);
  });

  it("rejects empty, reversed and oversized batches", () => {
    expect(expandUnitNumbers(" , ")).toBe("empty");
    expect(expandUnitNumbers("110-101")).toBe("invalid");
    expect(expandUnitNumbers("x".repeat(21))).toBe("invalid");
    expect(expandUnitNumbers(`1-${MAX_UNITS_PER_BATCH + 1}`)).toBe("too-many");
  });
});
