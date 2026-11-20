import type { DocumentType } from "@/shared/domain/identity-document";
import {
  canonicalJson,
  sha256,
  type SignatureDevice,
  type SignatureLocation,
} from "@/shared/domain/signature/signature-capture";

// The generic pieces (drawing, device, location, digests) live in
// shared/domain/signature; re-exported for the parcels module.
export * from "@/shared/domain/signature/signature-capture";

// The handwritten electronic signature of whoever picks up a parcel, drawn
// with a finger or a stylus on the gate's screen. It is backed by evidence
// (Lei 14.063/2020; MP 2.200-2/2001, art. 10, § 2º): the declaration the
// signer saw, the drawing itself (each point's position, time and pressure)
// and its image, server and device time, IP, browser, device, location
// when allowed, the staff member and session that collected it, and a
// SHA-256 digest of all of it, so any later change is detectable.

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
