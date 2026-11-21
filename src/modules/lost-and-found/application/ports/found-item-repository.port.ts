import type {
  ClaimStatus,
  FoundItemCategory,
  FoundItemStatus,
} from "@/modules/lost-and-found/domain/found-item";
import type { ReturnEvidence } from "@/modules/lost-and-found/domain/return-evidence";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import type {
  SignatureDrawing,
  SignatureLocation,
} from "@/shared/domain/signature/signature-capture";

/** A found item as stored, with the staff and owner names. */
export type FoundItem = {
  id: string;
  condominiumId: string;
  category: FoundItemCategory;
  title: string;
  /** What residents see about it. */
  description: string | null;
  /** Only the staff sees it: to check whoever claims it. */
  privateDetails: string | null;
  foundLocation: string;
  foundAt: Date;
  storageLocation: string;
  photoKey: string | null;
  /** The photo is not shown to residents (e.g. a document). */
  photoHidden: boolean;
  status: FoundItemStatus;
  registeredById: string | null;
  registeredByName: string | null;
  keepUntil: Date;
  expiryNotifiedAt: Date | null;
  closedAt: Date | null;
  closedById: string | null;
  closedByName: string | null;
  closeReason: string | null;
  /** Returned to a resident (their claim): who. */
  returnedToId: string | null;
  returnedToName: string | null;
  /** Returned: who signed (null otherwise). */
  signerName: string | null;
  /** Claims waiting for the staff. */
  pendingClaims: number;
  /** Whose accepted claim it waits for (they may come for it); null: none. */
  awaitedByName: string | null;
  /**
   * Reserved by the desk for a unit (its residents see it) or one of its
   * residents (only them); null: anyone may claim it.
   */
  ownerUnitId: string | null;
  ownerUnitLabel: string | null;
  ownerUserId: string | null;
  ownerUserName: string | null;
  createdAt: Date;
};

export type NewFoundItem = {
  condominiumId: string;
  category: FoundItemCategory;
  title: string;
  description: string | null;
  privateDetails: string | null;
  foundLocation: string;
  foundAt: Date;
  storageLocation: string;
  photoKey: string | null;
  photoHidden: boolean;
  keepUntil: Date;
  registeredBy: string;
  /** Whose the desk says it is (null: unknown). */
  ownerUnitId: string | null;
  ownerUserId: string | null;
  /**
   * The "Perdi algo" report it answers: ended as found, linked to it, in
   * the same transaction (null: none). Already ended: nothing is created.
   */
  lostReportId: string | null;
};

/** Who browses the kept items (reserved ones show only to their owner). */
export type KeptViewer = { userId: string; unitId: string | null };

/** Filters of the condominium's items (null / false: any). */
export type FoundItemFilter = {
  statuses: FoundItemStatus[] | null;
  category: FoundItemCategory | null;
  /** Part of the title, the description or where it was found. */
  search: string | null;
  /** Only items with claims waiting for the staff. */
  withPendingClaims: boolean;
  /** Exactly these (from the filter lists; case and accents ignored). */
  title: string | null;
  foundLocation: string | null;
  storageLocation: string | null;
  /** Reserved for this resident, or claimed by them. */
  residentId: string | null;
  /** Found on or after / before these instants. */
  from: Date | null;
  to: Date | null;
};

/** The items at a glance. */
export type FoundItemOverview = {
  byStatus: { status: FoundItemStatus; count: number }[];
  /** Claims waiting for the staff. */
  pendingClaims: number;
  /** Kept items whose keeping period ends within the notice window. */
  expiringSoon: number;
  /** The values in use, for the filter lists (most recent first). */
  titles: string[];
  foundLocations: string[];
  storageLocations: string[];
  /** Residents an item was reserved for or who claimed one. */
  residents: { id: string; name: string }[];
};

/** A claim, with the item and the resident it came from. */
export type FoundItemClaim = {
  id: string;
  itemId: string;
  itemTitle: string;
  itemStatus: FoundItemStatus;
  itemCategory: FoundItemCategory;
  condominiumId: string;
  userId: string;
  userName: string;
  /** The resident's unit, "Bloco A · 101" (null: none). */
  unitLabel: string | null;
  /** What the resident added (optional). */
  message: string | null;
  status: ClaimStatus;
  createdAt: Date;
  decidedAt: Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
};

/** The return as stored (the signature, its evidence and digests). */
export type FoundItemReturn = {
  itemId: string;
  claimId: string | null;
  signerName: string;
  signerDocumentType: ReturnEvidence["signerDocumentType"];
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
  device: ReturnEvidence["device"];
  location: SignatureLocation;
  collectedById: string;
  collectedByName: string;
  collectedByRole: string;
  evidence: unknown;
  evidenceSha256: string;
};

/** What the return writes. */
export type NewFoundItemReturn = ReturnEvidence & {
  imageKey: string;
  drawing: SignatureDrawing;
  /** `canonicalJson` of the evidence: what `evidenceSha256` digests. */
  evidenceJson: string;
  evidenceSha256: string;
};

export type ClaimDecision = {
  status: ClaimStatus.ACCEPTED | ClaimStatus.REJECTED;
  note: string | null;
  by: string;
  at: Date;
};

export type ItemClosing = {
  status: FoundItemStatus.DONATED | FoundItemStatus.DISCARDED;
  reason: string;
  by: string;
  at: Date;
};

/** The pending claims a change rejects, with the note they get. */
export type ClosedClaims = FoundItemClaim[];

export interface FoundItemRepositoryPort {
  /**
   * Stores the item with the notices of its owner (one transaction); a
   * resident owner gets an accepted claim.
   */
  create(
    item: NewFoundItem,
    notices: (item: FoundItem) => OutboxDraft[],
  ): Promise<FoundItem>;
  /**
   * Lifts the reservation of a kept item (the owner's open claim is
   * withdrawn); null when it was not reserved or left meanwhile.
   */
  release(
    itemId: string,
    by: string,
    at: Date,
    notices: (item: FoundItem) => OutboxDraft[],
  ): Promise<FoundItem | null>;
  /** Only an item of this condominium. */
  find(condominiumId: string, id: string): Promise<FoundItem | null>;
  /** The condominium's items that match: kept first, newest first. */
  list(
    condominiumId: string,
    filter: FoundItemFilter,
    page: PageRequest,
  ): Promise<Paginated<FoundItem>>;
  /** What residents browse: items still kept, newest first. */
  listKept(
    condominiumId: string,
    category: FoundItemCategory | null,
    viewer: KeptViewer,
    page: PageRequest,
  ): Promise<Paginated<FoundItem>>;
  overview(
    condominiumId: string,
    expiringBefore: Date,
  ): Promise<FoundItemOverview>;

  /** An item's claims, newest first. */
  claimsOf(itemId: string): Promise<FoundItemClaim[]>;
  /** One person's latest claim on an item (null: none). */
  latestClaimBy(itemId: string, userId: string): Promise<FoundItemClaim | null>;
  findClaim(condominiumId: string, id: string): Promise<FoundItemClaim | null>;
  /** A resident's claims in this condominium, newest first. */
  claimsBy(
    condominiumId: string,
    userId: string,
    page: PageRequest,
  ): Promise<Paginated<FoundItemClaim>>;
  /**
   * The condominium's claims (the desk): `open` keeps those waiting or
   * accepted on items still kept, oldest first (a queue); otherwise every
   * claim, newest first.
   */
  claimsIn(
    condominiumId: string,
    open: boolean,
    page: PageRequest,
  ): Promise<Paginated<FoundItemClaim>>;
  /**
   * Opens a claim, only while the item is kept and the person has no open
   * claim on it (null otherwise). Notices go with it.
   */
  claim(
    itemId: string,
    userId: string,
    message: string | null,
    notices: (claim: FoundItemClaim) => OutboxDraft[],
  ): Promise<FoundItemClaim | null>;
  /** Withdraws a pending claim of this person (false: not pending). */
  withdrawClaim(claimId: string, userId: string): Promise<boolean>;
  /** Accepts or rejects a pending claim (null: no longer pending). */
  decideClaim(
    claimId: string,
    decision: ClaimDecision,
    notices: (claim: FoundItemClaim) => OutboxDraft[],
  ): Promise<FoundItemClaim | null>;

  /**
   * Marks the item returned and stores the signature, only while it is
   * kept (null otherwise). The other open claims are rejected with `note`;
   * notices get the item and those claims.
   */
  returnItem(
    itemId: string,
    record: NewFoundItemReturn,
    note: string,
    notices: (item: FoundItem, rejected: ClosedClaims) => OutboxDraft[],
  ): Promise<FoundItem | null>;
  /** Donated or discarded, only while kept; open claims are rejected. */
  close(
    itemId: string,
    closing: ItemClosing,
    note: string,
    notices: (item: FoundItem, rejected: ClosedClaims) => OutboxDraft[],
  ): Promise<FoundItem | null>;
  findReturn(itemId: string): Promise<FoundItemReturn | null>;

  /** Kept items whose keeping period ends before `before`, not yet told. */
  dueExpiry(before: Date, limit: number): Promise<FoundItem[]>;
  markExpiryNotified(
    id: string,
    at: Date,
    notices: OutboxDraft[],
  ): Promise<boolean>;
  /**
   * Clears the photo of items closed before `closedBefore` and returns the
   * keys to delete from storage.
   */
  releasePhotos(closedBefore: Date): Promise<string[]>;
}

export const FOUND_ITEM_REPOSITORY = Symbol("FOUND_ITEM_REPOSITORY");
