import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { ParcelStatus } from "@/modules/parcels/domain/parcel";
import type {
  SignatureDevice,
  SignatureDrawing,
  SignatureEvidence,
  SignatureLocation,
} from "@/modules/parcels/domain/parcel-signature";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import type { DocumentType } from "@/shared/domain/identity-document";

/** A parcel as stored, with its unit and the staff names. */
export type Parcel = {
  id: string;
  condominiumId: string;
  unitId: string | null;
  /** "Bloco A · 101" (null: the unit was removed). */
  unitLabel: string | null;
  recipientName: string | null;
  /**
   * Registered for this resident by name: only they are told and see it
   * (null: the whole unit).
   */
  recipientUserId: string | null;
  carrier: string | null;
  trackingCode: string | null;
  notes: string | null;
  storageLocation: string | null;
  photoKey: string | null;
  pickupCode: string;
  status: ParcelStatus;
  receivedAt: Date;
  receivedById: string | null;
  receivedByName: string | null;
  closedAt: Date | null;
  closedById: string | null;
  closedByName: string | null;
  closeReason: string | null;
  remindedAt: Date | null;
  /** Picked up: who signed (null otherwise). */
  signerName: string | null;
};

export type NewParcel = {
  condominiumId: string;
  unitId: string;
  recipientName: string | null;
  recipientUserId: string | null;
  carrier: string | null;
  trackingCode: string | null;
  notes: string | null;
  storageLocation: string | null;
  photoKey: string | null;
  pickupCode: string;
  receivedAt: Date;
  receivedBy: string;
};

/** The signature as stored (the evidence and the files' digests). */
export type ParcelSignature = {
  parcelId: string;
  signerName: string;
  signerDocumentType: DocumentType | null;
  signerDocument: string | null;
  declaration: string;
  imageKey: string;
  imageSha256: string;
  drawing: SignatureDrawing;
  strokesSha256: string;
  signedAt: Date;
  clientSignedAt: Date | null;
  clientTimeZone: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  device: SignatureDevice;
  location: SignatureLocation;
  collectedById: string;
  collectedByName: string;
  collectedByRole: string;
  sessionId: string | null;
  /** Everything the digest covers, as signed (parsed canonical JSON). */
  evidence: unknown;
  evidenceSha256: string;
};

/** What the pickup writes: the signature with its evidence. */
export type NewParcelSignature = SignatureEvidence & {
  imageKey: string;
  drawing: SignatureDrawing;
  /** `canonicalJson` of the evidence: what `evidenceSha256` digests. */
  evidenceJson: string;
  evidenceSha256: string;
};

/** Filters of the condominium's parcels (null: any). */
export type ParcelFilter = {
  statuses: ParcelStatus[] | null;
  unitId: string | null;
  /** Part of the pickup code, tracking code, recipient or carrier. */
  search: string | null;
  /** Received on or after / before these instants. */
  from: Date | null;
  to: Date | null;
};

/** The condominium's parcels at a glance, and the units for the filter. */
export type ParcelOverview = {
  byStatus: { status: ParcelStatus; count: number }[];
  /** Still at the gate past the reminder (PARCEL_REMINDER_DAYS). */
  waitingLong: number;
  units: { id: string; label: string }[];
};

export interface ParcelRepositoryPort {
  /** Stores the parcel; `notices` go to the outbox in the same transaction. */
  create(
    parcel: NewParcel,
    notices: (parcel: Parcel) => OutboxDraft[],
  ): Promise<Parcel>;
  /** Only a parcel of this condominium. */
  find(condominiumId: string, id: string): Promise<Parcel | null>;
  /** By its pickup code, in any condominium. */
  findByCode(code: string): Promise<Parcel | null>;
  /** The condominium's parcels that match: waiting first, newest first. */
  list(
    condominiumId: string,
    filter: ParcelFilter,
    page: PageRequest,
  ): Promise<Paginated<Parcel>>;
  /**
   * A unit's parcels that this resident may see (for the whole unit, or
   * for them by name): waiting first, newest first.
   */
  listForUnit(
    unitId: string,
    viewerId: string,
    statuses: ParcelStatus[] | null,
    page: PageRequest,
  ): Promise<Paginated<Parcel>>;
  overview(condominiumId: string, waitingSince: Date): Promise<ParcelOverview>;
  /**
   * Marks the parcel picked up and stores the signature, only while it is
   * still at the gate (null otherwise). Notices go with it.
   */
  pickUp(
    id: string,
    signature: NewParcelSignature,
    notices: (parcel: Parcel) => OutboxDraft[],
  ): Promise<Parcel | null>;
  /** Returned or cancelled, only while at the gate (null otherwise). */
  close(
    id: string,
    change: {
      status: ParcelStatus.RETURNED | ParcelStatus.CANCELLED;
      reason: string;
      by: string;
      at: Date;
    },
    notices: (parcel: Parcel) => OutboxDraft[],
  ): Promise<Parcel | null>;
  findSignature(parcelId: string): Promise<ParcelSignature | null>;
  /** Parcels at the gate since before `receivedBefore`, never reminded. */
  dueReminders(receivedBefore: Date, limit: number): Promise<Parcel[]>;
  /**
   * Marks the parcel reminded with its notices, only while it is at the
   * gate and was never reminded (false otherwise).
   */
  markReminded(id: string, at: Date, notices: OutboxDraft[]): Promise<boolean>;
  /**
   * Clears the photo of parcels closed before `closedBefore` and returns the
   * keys to delete from storage.
   */
  releasePhotos(closedBefore: Date): Promise<string[]>;
}

export const PARCEL_REPOSITORY = Symbol("PARCEL_REPOSITORY");
