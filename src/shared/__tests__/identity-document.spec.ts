import {
  DocumentType,
  formatDocument,
  normalizeCpf,
  normalizeRg,
} from "@/shared/domain/identity-document";

describe("CPF", () => {
  it("accepts valid check digits, with or without the mask", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(normalizeCpf("52998224725")).toBe("52998224725");
  });

  it("refuses wrong check digits, repeated digits, letters and lengths", () => {
    expect(normalizeCpf("529.982.247-24")).toBeNull();
    expect(normalizeCpf("111.111.111-11")).toBeNull();
    expect(normalizeCpf("5299822472")).toBeNull();
    expect(normalizeCpf("abc")).toBeNull();
    expect(normalizeCpf("529.982.247-25abc")).toBeNull();
  });
});

describe("RG", () => {
  it("keeps digits and a final X", () => {
    expect(normalizeRg("12.345.678-9")).toBe("123456789");
    expect(normalizeRg("12.345.678-x")).toBe("12345678X");
    expect(normalizeRg("1.234.567")).toBe("1234567");
  });

  it("refuses letters inside, X in the middle and odd lengths", () => {
    expect(normalizeRg("12A45678")).toBeNull();
    expect(normalizeRg("12X456789")).toBeNull();
    expect(normalizeRg("12345")).toBeNull();
    expect(normalizeRg("12345678901")).toBeNull();
  });
});

describe("formatDocument", () => {
  it("shows each document in its usual shape", () => {
    expect(formatDocument(DocumentType.CPF, "52998224725")).toBe(
      "529.982.247-25",
    );
    expect(formatDocument(DocumentType.RG, "123456789")).toBe("12.345.678-9");
    expect(formatDocument(DocumentType.RG, "12345678X")).toBe("12.345.678-X");
    expect(formatDocument(DocumentType.RG, "12345678")).toBe("1.234.567-8");
  });
});
