import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  type ApprovalOutcome,
  PURCHASE_APPROVAL_REPOSITORY,
  type PurchaseApprovalRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import {
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { approvalDecidedNotices } from "@/modules/purchases/application/purchase-approval-notices";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  APPROVAL_LIMITS,
  ApprovalDecision,
  type NewApproval,
} from "@/modules/purchases/domain/purchase-approval";
import { quoteTotals } from "@/modules/purchases/domain/purchase-quote";
import {
  type PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

type Decision =
  | ApprovalDecision.APPROVED
  | ApprovalDecision.RETURNED
  | ApprovalDecision.REJECTED;

const OUTCOME: Record<Decision, ApprovalOutcome> = {
  [ApprovalDecision.APPROVED]: PurchaseRequestStatus.APPROVED,
  [ApprovalDecision.RETURNED]: PurchaseRequestStatus.QUOTING,
  [ApprovalDecision.REJECTED]: PurchaseRequestStatus.REJECTED,
};

/** The note as kept: spaces collapsed, null when empty. */
const cleanNote = (value: string | null | undefined) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text ? text : null;
};

// An approver decides on a chosen quote waiting for approval: approve it
// (an optional note), send it back to quotes (the choice is undone) or
// reject it (the request ends); the last two need the reason. Whoever chose
// it may also approve it: the record keeps who chose and who decided.
// Whoever asked for it and the managers are told.
@Injectable()
export class DecidePurchaseApprovalUseCase {
  constructor(
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    @Inject(PURCHASE_QUOTE_REPOSITORY)
    private readonly quotes: PurchaseQuoteRepositoryPort,
    @Inject(PURCHASE_APPROVAL_REPOSITORY)
    private readonly approvals: PurchaseApprovalRepositoryPort,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  approve(actor: AuthenticatedUser, requestId: string, note: string | null) {
    return this.decide(actor, requestId, ApprovalDecision.APPROVED, note);
  }

  returnToQuotes(actor: AuthenticatedUser, requestId: string, reason: string) {
    return this.decide(actor, requestId, ApprovalDecision.RETURNED, reason);
  }

  reject(actor: AuthenticatedUser, requestId: string, reason: string) {
    return this.decide(actor, requestId, ApprovalDecision.REJECTED, reason);
  }

  private async decide(
    actor: AuthenticatedUser,
    requestId: string,
    decision: Decision,
    noteInput: string | null,
  ): Promise<PurchaseRequest> {
    const condominiumId = await this.access.condominiumOf(actor);
    const request = await this.requests.find(condominiumId, requestId);
    if (!request) {
      throw AppException.from(APP_ERRORS.purchases.requestNotFound, undefined);
    }
    const note = cleanNote(noteInput);
    if (note && note.length > APPROVAL_LIMITS.note) {
      throw AppException.from(APP_ERRORS.purchases.requestInvalid, {
        reason: `A observação vai até ${APPROVAL_LIMITS.note} caracteres.`,
      });
    }
    if (decision !== ApprovalDecision.APPROVED && (!note || note.length < 3)) {
      throw AppException.from(APP_ERRORS.purchases.requestInvalid, {
        reason: "Diga o motivo (ao menos 3 letras).",
      });
    }
    const chosen =
      request.status === PurchaseRequestStatus.AWAITING_APPROVAL &&
      request.chosenQuoteId
        ? await this.quotes.find(condominiumId, request.chosenQuoteId)
        : null;
    if (!chosen) {
      throw AppException.from(
        APP_ERRORS.purchases.notAwaitingApproval,
        undefined,
      );
    }
    const quantities = new Map(
      request.items.map((item) => [item.id, item.quantity]),
    );
    const [settings, managers] = await Promise.all([
      this.approvals.settings(condominiumId),
      this.access.managers(condominiumId),
    ]);
    const approval: NewApproval = {
      requestId: request.id,
      quoteId: chosen.id,
      decision,
      supplierName: chosen.supplierName,
      totalCents: quoteTotals(chosen, quantities).totalCents,
      limitCents: settings.approvalLimitCents,
      note,
      chosenById: request.chosenById ?? null,
      decidedById: actor.id,
      decidedAt: this.clock.now(),
    };
    const done = await this.approvals.decide(
      request.id,
      OUTCOME[decision],
      approval,
      approvalDecidedNotices(
        request,
        approval,
        { id: actor.id, name: actor.name },
        managers,
      ),
    );
    if (!done) {
      throw AppException.from(
        APP_ERRORS.purchases.notAwaitingApproval,
        undefined,
      );
    }
    await this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: request.id,
    });
    const updated = await this.requests.find(condominiumId, request.id);
    if (!updated) {
      throw AppException.from(APP_ERRORS.purchases.requestNotFound, undefined);
    }
    return updated;
  }
}
