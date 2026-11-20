import {
  normalizeCloseReason,
  normalizeParcelCode,
  optionalText,
  PARCEL_CODE_LENGTH,
  parcelCode,
  perishableDeadline,
} from "@/modules/parcels/domain/parcel";
import {
  canonicalJson,
  evidenceDigest,
  LocationStatus,
  normalizeLocation,
  parseSignatureDrawing,
  pickupDeclaration,
  sanitizeDevice,
  signedDeclaration,
  type SignatureEvidence,
} from "@/modules/parcels/domain/parcel-signature";

/** A plausible signature: a zig-zag across most of the canvas. */
const drawing = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    width: 600,
    height: 200,
    strokes: [
      Array.from({ length: 30 }, (_, i) => [
        20 + i * 18,
        i % 2 ? 40 : 160,
        i * 16,
        0.5,
      ]),
    ],
    ...overrides,
  });

describe("pickup code", () => {
  it("has 6 characters of the unambiguous alphabet", () => {
    let i = 0;
    const code = parcelCode(() => i++ % 5);
    expect(code).toHaveLength(PARCEL_CODE_LENGTH);
    expect(normalizeParcelCode(code)).toBe(code);
  });

  it("accepts lower case, spaces and dashes; refuses other lengths and letters", () => {
    expect(normalizeParcelCode(" ab-c 234 ")).toBe("ABC234");
    expect(normalizeParcelCode("ABC23")).toBeNull();
    expect(normalizeParcelCode("ABC2345")).toBeNull();
    // O, 0, 1 and I are not used (they look alike).
    expect(normalizeParcelCode("ABCO12")).toBeNull();
  });
});

describe("texts", () => {
  it("trims, collapses spaces, turns empty into null and refuses long text", () => {
    expect(optionalText("  Mercado   Livre ", 60)).toBe("Mercado Livre");
    expect(optionalText("   ", 60)).toBeNull();
    expect(optionalText(null, 60)).toBeNull();
    expect(optionalText("x".repeat(61), 60)).toBeUndefined();
  });

  it("needs a reason of 3 to 300 characters", () => {
    expect(normalizeCloseReason(" recusada ")).toBe("recusada");
    expect(normalizeCloseReason("ok")).toBeNull();
    expect(normalizeCloseReason("x".repeat(301))).toBeNull();
  });
});

describe("signature drawing", () => {
  it("keeps a valid drawing, rounded", () => {
    const parsed = parseSignatureDrawing(drawing());
    expect(parsed?.strokes[0]).toHaveLength(30);
    expect(parsed?.width).toBe(600);
  });

  it("refuses malformed JSON, points off the canvas and time going back", () => {
    expect(parseSignatureDrawing("{")).toBeNull();
    expect(
      parseSignatureDrawing(drawing({ strokes: [[[700, 10, 0, 0.5]]] })),
    ).toBeNull();
    expect(
      parseSignatureDrawing(
        drawing({
          strokes: [
            [
              [10, 10, 50, 0.5],
              [20, 20, 10, 0.5],
            ],
          ],
        }),
      ),
    ).toBeNull();
  });

  it("refuses a dot or a few points", () => {
    const dot = Array.from({ length: 20 }, (_, i) => [100, 100, i, 0.5]);
    expect(parseSignatureDrawing(drawing({ strokes: [dot] }))).toBeNull();
    expect(
      parseSignatureDrawing(
        drawing({
          strokes: [
            [
              [10, 10, 0, 0.5],
              [500, 150, 10, 0.5],
            ],
          ],
        }),
      ),
    ).toBeNull();
  });
});

describe("evidence", () => {
  it("keeps only known device fields, bounded", () => {
    expect(
      sanitizeDevice({
        platform: "Android",
        pointerType: "touch",
        screenWidth: 1080,
        pixelRatio: 99,
        cookie: "secret",
      }),
    ).toEqual({ platform: "Android", pointerType: "touch", screenWidth: 1080 });
  });

  it("drops coordinates unless granted and in range", () => {
    expect(
      normalizeLocation({
        status: LocationStatus.GRANTED,
        latitude: -23.5505199,
        longitude: -46.6333094,
        accuracyMeters: 12.34,
      }),
    ).toEqual({
      status: LocationStatus.GRANTED,
      latitude: -23.55052,
      longitude: -46.633309,
      accuracyMeters: 12.3,
    });
    expect(
      normalizeLocation({
        status: LocationStatus.GRANTED,
        latitude: 200,
        longitude: 0,
      }).status,
    ).toBe(LocationStatus.UNAVAILABLE);
    expect(
      normalizeLocation({
        status: LocationStatus.DENIED,
        latitude: 1,
        longitude: 1,
      }),
    ).toMatchObject({ status: LocationStatus.DENIED, latitude: null });
  });

  it("writes the declaration with the parcel's details and the signer in front", () => {
    const text = pickupDeclaration({
      code: "ABC234",
      condominiumName: "Residencial Aurora",
      unitLabel: "A · 101",
      recipientName: "Maria",
      carrier: "Correios",
      trackingCode: null,
    });
    expect(text).toContain("Residencial Aurora");
    expect(text).toContain("ABC234");
    expect(text).toContain("unidade A · 101");
    expect(text).not.toContain("rastreio");
    expect(signedDeclaration("João Silva", text)).toMatch(
      /^Eu, João Silva, declaro/,
    );
  });

  it("digests the same evidence the same way, whatever the key order", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,1]},"b":1}',
    );
    const evidence: SignatureEvidence = {
      parcelId: "p",
      condominiumId: "c",
      unitId: "u",
      pickupCode: "ABC234",
      signerName: "João",
      signerDocumentType: null,
      signerDocument: null,
      declaration: "Eu, João, declaro…",
      imageSha256: "a".repeat(64),
      strokesSha256: "b".repeat(64),
      signedAt: new Date("2026-11-20T12:00:00Z"),
      clientSignedAt: null,
      clientTimeZone: "America/Sao_Paulo",
      ipAddress: "200.1.2.3",
      userAgent: "UA",
      device: { pointerType: "touch" },
      location: normalizeLocation({ status: LocationStatus.DENIED }),
      collectedBy: "staff",
      collectedByName: "Porteiro",
      collectedByRole: "CONCIERGE",
      sessionId: null,
      authorization: null,
    };
    const digest = evidenceDigest(evidence);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // Stored as JSON and read back (dates become strings): same digest.
    const roundTrip: unknown = JSON.parse(canonicalJson(evidence));
    expect(evidenceDigest(roundTrip as SignatureEvidence)).toBe(digest);
    expect(evidenceDigest({ ...evidence, signerName: "José" })).not.toBe(
      digest,
    );
  });
});

describe("perishable deadline", () => {
  const receivedAt = new Date("2026-11-20T12:00:00Z");

  it("adds one of the offered numbers of hours", () => {
    expect(perishableDeadline(receivedAt, 4)).toEqual(
      new Date("2026-11-20T16:00:00Z"),
    );
  });

  it("refuses any other number", () => {
    expect(perishableDeadline(receivedAt, 3)).toBeNull();
    expect(perishableDeadline(receivedAt, 0)).toBeNull();
  });
});
