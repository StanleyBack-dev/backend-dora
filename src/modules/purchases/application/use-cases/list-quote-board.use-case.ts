import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import {
  PURCHASE_QUOTE_REPOSITORY,
  type PurchaseQuoteRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestFilter,
  type PurchaseRequestRepositoryPort,
  type QuoteBoardOverview,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  cheapestQuoteIds,
  MIN_QUOTES,
  quoteTotals,
} from "@/modules/purchases/domain/purchase-quote";
import {
  type PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** The stages the quotes page shows. */
export const QUOTE_BOARD_STATUSES: readonly PurchaseRequestStatus[] = [
  PurchaseRequestStatus.OPEN,
  PurchaseRequestStatus.QUOTING,
  PurchaseRequestStatus.AWAITING_APPROVAL,
  // Decided: kept on the page so a quote doesn't vanish once approved.
  PurchaseRequestStatus.APPROVED,
  PurchaseRequestStatus.REJECTED,
];

/** A supplier and what it charges in the end. */
export type QuoteBoardPick = { supplierName: string; totalCents: number };

/** A request on the quotes page, with how its quotes stand. */
export type QuoteBoardRow = {
  request: PurchaseRequest;
  quoteCount: number;
  /** Quotes pricing every item. */
  completeCount: number;
  /** The cheapest complete quote (null: none yet). */
  cheapest: QuoteBoardPick | null;
  /** The chosen one (null: not chosen). */
  chosen: QuoteBoardPick | null;
};

// The management's quotes page: the requests in the quote stages (waiting
// for quotes, in quotes, waiting for the approval), filtered and paged
// here, each with its number of quotes, the cheapest complete one and the
// chosen one; and the page's cards.
@Injectable()
export class ListQuoteBoardUseCase {
  constructor(
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    @Inject(PURCHASE_QUOTE_REPOSITORY)
    private readonly quotes: PurchaseQuoteRepositoryPort,
    private readonly access: PurchasesAccessService,
  ) {}

  private async row(request: PurchaseRequest): Promise<QuoteBoardRow> {
    const quantities = new Map(
      request.items.map((item) => [item.id, item.quantity]),
    );
    const quotes = (await this.quotes.listFor(request.id)).map((quote) => ({
      quote,
      totals: quoteTotals(quote, quantities),
    }));
    const cheapestId = cheapestQuoteIds(
      quotes.map(({ quote, totals }) => ({ id: quote.id, ...totals })),
    )[0];
    const pick = (id: string | null | undefined): QuoteBoardPick | null => {
      const found = quotes.find(({ quote }) => quote.id === id);
      return found
        ? {
            supplierName: found.quote.supplierName,
            totalCents: found.totals.totalCents,
          }
        : null;
    };
    return {
      request,
      quoteCount: quotes.length,
      completeCount: quotes.filter(({ totals }) => totals.complete).length,
      cheapest: pick(cheapestId),
      chosen: pick(request.chosenQuoteId),
    };
  }

  async list(
    actor: AuthenticatedUser,
    filter: PurchaseRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<QuoteBoardRow>> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.rows(condominiumId, filter, page, QUOTE_BOARD_STATUSES);
  }

  /**
   * The rows of some stages (other statuses asked: nothing listed); the
   * approvals page uses it too.
   */
  async rows(
    condominiumId: string,
    filter: PurchaseRequestFilter,
    page: PageRequest,
    stages: readonly PurchaseRequestStatus[],
  ): Promise<Paginated<QuoteBoardRow>> {
    const statuses = filter.statuses?.length
      ? filter.statuses.filter((status) => stages.includes(status))
      : [...stages];
    if (!statuses.length) {
      return {
        items: [],
        total: 0,
        page: page.page,
        limit: page.limit,
        totalPages: 1,
      };
    }
    const requests = await this.requests.list(
      { condominiumId, requesterId: null },
      { ...filter, statuses },
      page,
    );
    return {
      ...requests,
      items: await Promise.all(
        requests.items.map((request) => this.row(request)),
      ),
    };
  }

  async overview(actor: AuthenticatedUser): Promise<QuoteBoardOverview> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.requests.quoteBoardOverview(condominiumId, MIN_QUOTES);
  }
}
