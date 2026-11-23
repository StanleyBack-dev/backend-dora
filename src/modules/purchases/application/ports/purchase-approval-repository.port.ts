import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type {
  ApprovalMode,
  NewApproval,
  PurchaseApproval,
  PurchaseSettings,
} from "@/modules/purchases/domain/purchase-approval";
import type { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";

/** Where an approver's decision takes a request waiting for it. */
export type ApprovalOutcome =
  | PurchaseRequestStatus.APPROVED
  | PurchaseRequestStatus.QUOTING
  | PurchaseRequestStatus.REJECTED;

/** The approvals page's cards. */
export type ApprovalOverview = {
  /** Waiting for an approver. */
  awaiting: number;
  /** Approved this month (by an approver or within the limit). */
  approvedThisMonth: number;
  /** Returned to quotes this month. */
  returnedThisMonth: number;
  /** Rejected this month. */
  rejectedThisMonth: number;
};

export interface PurchaseApprovalRepositoryPort {
  /** The condominium's settings (the defaults until set). */
  settings(condominiumId: string): Promise<PurchaseSettings>;
  saveSettings(
    condominiumId: string,
    mode: ApprovalMode,
    limitCents: number | null,
    updatedBy: string,
  ): Promise<PurchaseSettings>;
  /** The decisions on a request, the latest first. */
  history(requestId: string): Promise<PurchaseApproval[]>;
  /**
   * Records an approver's decision on a request waiting for it and moves it
   * on (back to quotes: the choice is undone), with the notices, in one
   * transaction. false: it no longer waits (nothing is written).
   */
  decide(
    requestId: string,
    outcome: ApprovalOutcome,
    approval: NewApproval,
    notices: OutboxDraft[],
  ): Promise<boolean>;
  /** The cards, with "this month" from `monthStart`. */
  overview(condominiumId: string, monthStart: Date): Promise<ApprovalOverview>;
}

export const PURCHASE_APPROVAL_REPOSITORY = Symbol(
  "PURCHASE_APPROVAL_REPOSITORY",
);
