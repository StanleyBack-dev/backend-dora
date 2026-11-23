// The approval of a chosen quote (aprovação por alçada).

/** How a condominium approves its purchases. */
export enum ApprovalMode {
  /** Every chosen quote waits for an approver. */
  ALWAYS = "ALWAYS",
  /** Up to the limit it is approved on choosing; above it, it waits. */
  LIMIT = "LIMIT",
}

export enum ApprovalDecision {
  /** Within the limit: approved when the quote was chosen. */
  AUTO_APPROVED = "AUTO_APPROVED",
  APPROVED = "APPROVED",
  /** Sent back to quotes, with the reason (the choice is undone). */
  RETURNED = "RETURNED",
  /** Not approved, with the reason: the request ends. */
  REJECTED = "REJECTED",
}

export type PurchaseSettings = {
  approvalMode: ApprovalMode;
  /** With LIMIT, in cents (null with ALWAYS). */
  approvalLimitCents: number | null;
  /** null: never changed (the defaults). */
  updatedAt: Date | null;
  updatedByName: string | null;
};

/** Until a condominium sets it: every purchase waits for an approver. */
export const DEFAULT_PURCHASE_SETTINGS: PurchaseSettings = {
  approvalMode: ApprovalMode.ALWAYS,
  approvalLimitCents: null,
  updatedAt: null,
  updatedByName: null,
};

export const APPROVAL_LIMITS = {
  note: 300,
  /** R$ 1 bilhão: well above any purchase. */
  maxLimitCents: 100_000_000_000,
} as const;

/** One decision on a request, as it was then. */
export type PurchaseApproval = {
  id: string;
  requestId: string;
  /** null: the quote was removed later. */
  quoteId: string | null;
  decision: ApprovalDecision;
  supplierName: string;
  totalCents: number;
  /** The limit in force (null: every purchase waited). */
  limitCents: number | null;
  note: string | null;
  chosenById: string | null;
  chosenByName: string | null;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: Date;
};

/** A decision to record. */
export type NewApproval = Omit<
  PurchaseApproval,
  "id" | "chosenByName" | "decidedByName" | "decidedAt"
> & { decidedAt: Date };

/** Whether a quote of this total is approved as soon as it is chosen. */
export const approvedOnChoosing = (
  settings: Pick<PurchaseSettings, "approvalMode" | "approvalLimitCents">,
  totalCents: number,
) =>
  settings.approvalMode === ApprovalMode.LIMIT &&
  settings.approvalLimitCents !== null &&
  totalCents <= settings.approvalLimitCents;
