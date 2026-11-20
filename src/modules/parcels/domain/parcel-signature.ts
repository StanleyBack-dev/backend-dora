import { createHash } from "node:crypto";
import {
  DocumentType,
  formatDocument,
} from "@/shared/domain/identity-document";

// The handwritten electronic signature of whoever picks up a parcel, drawn
// with a finger or a stylus on the gate's screen. It is backed by evidence
// (Lei 14.063/2020; MP 2.200-2/2001, art. 10, § 2º): the declaration the
// signer saw, the drawing itself (each point's position, time and pressure)
// and its image, server and device time, IP, browser, device, location
// when allowed, the staff member and session that collected it, and a
// SHA-256 digest of all of it, so any later change is detectable.

export enum LocationStatus {
  GRANTED = "GRANTED",
  /** The device or the person refused it. */
  DENIED = "DENIED",
  /** Not supported, timed out or failed. */
  UNAVAILABLE = "UNAVAILABLE",
}

/** One point: x, y (canvas pixels), t (ms since the first point), pressure (0-1). */
export type StrokePoint = [number, number, number, number];

/** The drawing as captured on a canvas of this size. */
export type SignatureDrawing = {
  width: number;
  height: number;
  strokes: StrokePoint[][];
};

export const SIGNATURE_LIMITS = {
  minSide: 50,
  maxSide: 4000,
  maxStrokes: 100,
  minPoints: 10,
  maxPoints: 10_000,
  /** The whole drawing within 10 minutes. */
  maxDurationMs: 600_000,
  /** The ink must span at least this share of the canvas (not a dot). */
  minSpan: 0.1,
} as const;

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * The drawing sent by the device (JSON), checked and rounded; null when it
 * is malformed, out of bounds or too small to be a signature.
 */
export function parseSignatureDrawing(json: string): SignatureDrawing | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const { width, height, strokes } = raw as Record<string, unknown>;
  const { minSide, maxSide, maxStrokes, minPoints, maxPoints } =
    SIGNATURE_LIMITS;
  if (
    !isNumber(width) ||
    !isNumber(height) ||
    width < minSide ||
    height < minSide ||
    width > maxSide ||
    height > maxSide ||
    !Array.isArray(strokes) ||
    strokes.length === 0 ||
    strokes.length > maxStrokes
  ) {
    return null;
  }

  const parsed: StrokePoint[][] = [];
  let total = 0;
  let lastT = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes as unknown[]) {
    if (!Array.isArray(stroke) || stroke.length === 0) return null;
    const points: StrokePoint[] = [];
    for (const point of stroke as unknown[]) {
      if (!Array.isArray(point) || point.length !== 4) return null;
      const [x, y, t, p] = point as unknown[];
      if (
        !isNumber(x) ||
        !isNumber(y) ||
        !isNumber(t) ||
        !isNumber(p) ||
        x < 0 ||
        y < 0 ||
        x > width ||
        y > height ||
        t < lastT ||
        t > SIGNATURE_LIMITS.maxDurationMs ||
        p < 0 ||
        p > 1
      ) {
        return null;
      }
      lastT = t;
      total += 1;
      if (total > maxPoints) return null;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      points.push([round(x, 1), round(y, 1), Math.round(t), round(p, 2)]);
    }
    parsed.push(points);
  }
  const span = Math.max((maxX - minX) / width, (maxY - minY) / height);
  if (total < minPoints || span < SIGNATURE_LIMITS.minSpan) return null;
  return { width: round(width, 1), height: round(height, 1), strokes: parsed };
}

/** About the device the signature was drawn on (each value optional). */
export type SignatureDevice = {
  platform?: string;
  language?: string;
  screenWidth?: number;
  screenHeight?: number;
  pixelRatio?: number;
  /** "touch", "pen" or "mouse": how the signature was drawn. */
  pointerType?: string;
  maxTouchPoints?: number;
};

const shortText = (value: unknown, max: number) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;

const boundedNumber = (value: unknown, max: number) =>
  isNumber(value) && value >= 0 && value <= max ? round(value, 2) : undefined;

/** Keeps only the known fields, bounded (whatever else was sent is dropped). */
export function sanitizeDevice(
  device: Record<string, unknown> | null | undefined,
): SignatureDevice {
  const source = device ?? {};
  const clean: SignatureDevice = {
    platform: shortText(source.platform, 60),
    language: shortText(source.language, 35),
    screenWidth: boundedNumber(source.screenWidth, 20_000),
    screenHeight: boundedNumber(source.screenHeight, 20_000),
    pixelRatio: boundedNumber(source.pixelRatio, 10),
    pointerType: shortText(source.pointerType, 10),
    maxTouchPoints: boundedNumber(source.maxTouchPoints, 100),
  };
  return Object.fromEntries(
    Object.entries(clean).filter(([, value]) => value !== undefined),
  ) as SignatureDevice;
}

/** Where the device was, as the browser reported it. */
export type SignatureLocation =
  | {
      status: LocationStatus.GRANTED;
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
    }
  | {
      status: LocationStatus.DENIED | LocationStatus.UNAVAILABLE;
      latitude: null;
      longitude: null;
      accuracyMeters: null;
    };

/** The location sent, checked; coordinates out of range count as unavailable. */
export function normalizeLocation(input: {
  status: LocationStatus;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
}): SignatureLocation {
  const { status, latitude, longitude, accuracyMeters } = input;
  if (
    status === LocationStatus.GRANTED &&
    isNumber(latitude) &&
    isNumber(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  ) {
    return {
      status,
      latitude: round(latitude, 6),
      longitude: round(longitude, 6),
      accuracyMeters:
        isNumber(accuracyMeters) && accuracyMeters >= 0
          ? round(Math.min(accuracyMeters, 99_999_999), 1)
          : null,
    };
  }
  return {
    status:
      status === LocationStatus.DENIED
        ? LocationStatus.DENIED
        : LocationStatus.UNAVAILABLE,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
  };
}

/** What the declaration says about the parcel. */
export type DeclarationParcel = {
  code: string;
  condominiumName: string;
  unitLabel: string | null;
  recipientName: string | null;
  carrier: string | null;
  trackingCode: string | null;
};

/**
 * The declaration shown before signing (the signer's name goes in front:
 * see `signedDeclaration`).
 */
export function pickupDeclaration(parcel: DeclarationParcel): string {
  const details = [
    parcel.unitLabel ? `destinada à unidade ${parcel.unitLabel}` : null,
    parcel.recipientName ? `em nome de ${parcel.recipientName}` : null,
    parcel.carrier ? `entregue por ${parcel.carrier}` : null,
    parcel.trackingCode ? `rastreio ${parcel.trackingCode}` : null,
  ].filter(Boolean);
  return (
    `declaro que recebi do ${parcel.condominiumName} a encomenda de código ${parcel.code}` +
    (details.length ? `, ${details.join(", ")}` : "") +
    ", na data e hora deste registro, e que esta assinatura eletrônica, feita por mim nesta tela, " +
    "expressa minha concordância com esta declaração (Lei nº 14.063/2020 e MP nº 2.200-2/2001, art. 10, § 2º)."
  );
}

/** "Eu, Maria Souza, declaro que…" (the document, when given, is kept apart). */
export function signedDeclaration(
  signerName: string,
  declaration: string,
): string {
  return `Eu, ${signerName}, ${declaration}`;
}

/** JSON with object keys sorted at every level: the same data, the same text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export const sha256 = (data: string | Buffer): string =>
  createHash("sha256").update(data).digest("hex");

/** Everything the signature's digest covers. */
export type SignatureEvidence = {
  parcelId: string;
  condominiumId: string;
  unitId: string | null;
  pickupCode: string;
  signerName: string;
  signerDocumentType: DocumentType | null;
  signerDocument: string | null;
  declaration: string;
  imageSha256: string;
  strokesSha256: string;
  signedAt: Date;
  clientSignedAt: Date | null;
  clientTimeZone: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  device: SignatureDevice;
  location: SignatureLocation;
  collectedBy: string;
  collectedByName: string;
  /** The deliverer's role there (CONCIERGE: gate, ADMIN: administration). */
  collectedByRole: string;
  sessionId: string | null;
  /** Picked up by someone a resident authorized (null: no authorization). */
  authorization: AuthorizationEvidence | null;
};

/** The authorization in force when the parcel was picked up. */
export type AuthorizationEvidence = {
  name: string;
  documentType: DocumentType | null;
  document: string | null;
  authorizedBy: string | null;
  authorizedByName: string | null;
  authorizedAt: Date;
};

/** The digest stored with the signature; recomputing it verifies the record. */
export const evidenceDigest = (evidence: SignatureEvidence): string =>
  sha256(canonicalJson(evidence));

/** Only the middle of the document shows: enough to recognise, not to reuse. */
export function maskDocument(type: DocumentType, value: string): string {
  const formatted = formatDocument(type, value);
  if (type === DocumentType.CPF) {
    return `***.${formatted.slice(4, 11)}-**`;
  }
  return `${value.slice(0, 2)}${"*".repeat(value.length - 3)}${value.slice(-1)}`;
}

const POINTER_LABELS: Record<string, string> = {
  touch: "o dedo",
  pen: "caneta",
  mouse: "mouse",
};

/** The device facts worth reading ("iPhone · assinado com o dedo · …"). */
export function deviceFacts(device: SignatureDevice): string | null {
  const parts = [
    device.platform ?? null,
    device.pointerType
      ? `assinado com ${POINTER_LABELS[device.pointerType] ?? device.pointerType}`
      : null,
    device.screenWidth && device.screenHeight
      ? `tela ${device.screenWidth}×${device.screenHeight}`
      : null,
    device.language ?? null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
