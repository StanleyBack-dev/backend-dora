import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { normalizeJustification } from "@/modules/purchases/application/purchase-quote-input";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  choiceNeedsJustification,
  quoteTotals,
} from "@/modules/purchases/domain/purchase-quote";
import type { PurchaseRequest } from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The management chooses the winning quote: the request goes to "Aguardando
// aprovação" (approved in the next phase). A justification is required
// when it isn't the cheapest complete quote or there are fewer than three
// quotes. While waiting for the approval, the choice can be undone (back to
// "Em cotação").
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
    const chosen = await this.quotes.choose(
      request.id,
      quoteId,
      justification,
      actor.id,
      this.clock.now(),
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
