import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  PURCHASE_APPROVAL_REPOSITORY,
  type PurchaseApprovalRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import {
  type ChoiceOutcome,
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import {
  approvalDecidedNotices,
  approvalRequestedNotices,
} from "@/modules/purchases/application/purchase-approval-notices";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { normalizeJustification } from "@/modules/purchases/application/purchase-quote-input";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ApprovalDecision,
  approvedOnChoosing,
} from "@/modules/purchases/domain/purchase-approval";
import {
  choiceNeedsJustification,
  quoteTotals,
} from "@/modules/purchases/domain/purchase-quote";
import type { PurchaseRequest } from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The management chooses the winning quote. A justification is required
// when it isn't the cheapest complete quote or there are fewer than three
// quotes. Then the condominium's approval settings decide: within the
// limit (LIMIT mode) it is approved at once ("dentro da alçada", told to
// whoever asked and the managers); otherwise it waits for an approver (told
// to the approvers). While waiting, the choice can be undone (back to "Em
// cotação").
@Injectable()
export class ChoosePurchaseQuoteUseCase {
  constructor(
    @Inject(PURCHASE_QUOTE_REPOSITORY)
    private readonly quotes: PurchaseQuoteRepositoryPort,
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(PURCHASE_APPROVAL_REPOSITORY)
    private readonly approvals: PurchaseApprovalRepositoryPort,
  ) {}

  private async reload(condominiumId: string, id: string) {
    const request = await this.requests.find(condominiumId, id);
    if (!request) {
      throw AppException.from(APP_ERRORS.purchases.requestNotFound, undefined);
    }
    return request;
  }

  private stamp(actor: AuthenticatedUser, id: string) {
    return this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: id,
    });
  }

  private async outcome(
    actor: AuthenticatedUser,
    request: PurchaseRequest,
    quote: { id: string; supplierName: string },
    totalCents: number,
    at: Date,
  ): Promise<ChoiceOutcome> {
    const settings = await this.approvals.settings(request.condominiumId);
    const facts = {
      requestId: request.id,
      quoteId: quote.id,
      supplierName: quote.supplierName,
      totalCents,
      limitCents: settings.approvalLimitCents,
      chosenById: actor.id,
    };
    const who = { id: actor.id, name: actor.name };
    if (approvedOnChoosing(settings, totalCents)) {
      const autoApproval = {
        ...facts,
        decision: ApprovalDecision.AUTO_APPROVED,
        note: null,
        decidedById: actor.id,
        decidedAt: at,
      };
      return {
        autoApproval,
        notices: approvalDecidedNotices(
          request,
          autoApproval,
          who,
          await this.access.managers(request.condominiumId),
        ),
      };
    }
    return {
      autoApproval: null,
      notices: approvalRequestedNotices(
        request,
        facts,
        who,
        await this.access.approvers(request.condominiumId),
        at,
      ),
    };
  }

  async choose(
    actor: AuthenticatedUser,
    quoteId: string,
    justificationInput: string | null,
  ): Promise<PurchaseRequest> {
    const condominiumId = await this.access.condominiumOf(actor);
    const quote = await this.quotes.find(condominiumId, quoteId);
    if (!quote) {
      throw AppException.from(APP_ERRORS.purchases.quoteNotFound, undefined);
    }
    const request = await this.reload(condominiumId, quote.requestId);
    const quantities = new Map(
      request.items.map((item) => [item.id, item.quantity]),
    );
    const all = (await this.quotes.listFor(request.id)).map((each) => ({
      id: each.id,
      ...quoteTotals(each, quantities),
    }));
    const justification = normalizeJustification(justificationInput);
    if (choiceNeedsJustification(quoteId, all) && justification === null) {
      throw AppException.from(
        APP_ERRORS.purchases.justificationRequired,
        undefined,
      );
    }
    const at = this.clock.now();
    const totals = all.find((each) => each.id === quoteId);
    const chosen = await this.quotes.choose(
      request.id,
      quoteId,
      justification,
      actor.id,
      at,
      await this.outcome(actor, request, quote, totals?.totalCents ?? 0, at),
    );
    if (!chosen) {
      throw AppException.from(APP_ERRORS.purchases.quotesLocked, undefined);
    }
    await this.stamp(actor, request.id);
    return this.reload(condominiumId, request.id);
  }

  async reopen(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<PurchaseRequest> {
    const condominiumId = await this.access.condominiumOf(actor);
    await this.reload(condominiumId, requestId);
    if (!(await this.quotes.reopen(requestId))) {
      throw AppException.from(APP_ERRORS.purchases.quotesLocked, undefined);
    }
    await this.stamp(actor, requestId);
    return this.reload(condominiumId, requestId);
  }
}
