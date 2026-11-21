import type { DocumentType } from "@/shared/domain/identity-document";
import {
  canonicalJson,
  sha256,
  type SignatureDevice,
  type SignatureLocation,
} from "@/shared/domain/signature/signature-capture";

// The evidence of a lost item's return: who took it back (signing on the
// screen), the declaration they saw, the drawing and image digests, server
// and device time, IP, browser, device, location when allowed, and who
// handed it over. Its SHA-256 digest is stored with it: recomputing it
// shows whether the record changed.

export type ReturnEvidence = {
  itemId: string;
  condominiumId: string;
  /** The accepted claim it closes (null: handed over without one). */
  claimId: string | null;
  /** The resident who claimed it (null: someone else). */
  claimantId: string | null;
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
  collectedByRole: string;
  sessionId: string | null;
  /**
   * Handed over by its own claimant, the only active member of the team at
   * the time (otherwise a colleague must): written into the signed record.
   */
  selfHandover: boolean;
};

/** The digest stored with the return; recomputing it verifies the record. */
export const returnEvidenceDigest = (evidence: ReturnEvidence): string =>
  sha256(canonicalJson(evidence));
