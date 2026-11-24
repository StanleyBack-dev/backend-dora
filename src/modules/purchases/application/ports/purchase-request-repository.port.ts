import type { Category } from "@/modules/catalog/domain/category";
import type {
  PurchasePriority,
  PurchaseRequest,
  PurchaseRequestStatus,
} from "@/modules/purchases/domain/purchase-request";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** A request's form, already checked and normalized. */
export type PurchaseRequestData = {
  title: string;
  description: string | null;
  categories: Category[];
  categoryOther: string | null;
  priority: PurchasePriority;
  spaceId: string | null;
  location: string | null;
  neededBy: string | null;
  items: {
    productId: string;
    quantity: number;
    unit: string;
    /** null: any brand. */
    brandId: string | null;
    note: string | null;
  }[];
};

/** Whose requests: the whole condominium, or one requester's. */
export type PurchaseRequestScope = {
  condominiumId: string;
  /** null: every request (management); otherwise only theirs. */
  requesterId: string | null;
};

export type PurchaseRequestFilter = {
  requestId?: string;
  requestedById?: string;
  /** Requests with this category among theirs. */
  category?: Category;
  priority?: PurchasePriority;
  statuses?: PurchaseRequestStatus[];
};

/** What the filters offer: the requests and requesters in the scope. */
export type PurchaseRequestFilterOptions = {
  requests: { id: string; number: number; title: string }[];
  requesters: { id: string; name: string }[];
};

/** The requests in numbers (the page's cards), whatever the filters. */
export type PurchaseRequestOverview = {
  /** Waiting for quotes. */
  open: number;
  /** Pending (quotes or approval) and marked urgent. */
  urgent: number;
  /** Pending and needed within the next 7 days. */
  dueSoon: number;
  /** Pending and past the day they were needed by. */
  overdue: number;
};

/** The requests in the quote stages, in numbers (the quotes page's cards). */
export type QuoteBoardOverview = {
  /** Waiting for the first quote. */
  awaitingQuotes: number;
  /** In quotes. */
  quoting: number;
  /** In quotes with fewer quotes than recommended. */
  belowMinimum: number;
  /** A quote chosen, waiting for the approval. */
  awaitingApproval: number;
};

/** How the catalog is used by the requests (the catalog pages' cards). */
export type PurchaseCatalogUsage = {
  /** Products in at least one request. */
  productsInUse: number;
  /** The product in most requests (null: none yet). */
  topProduct: { name: string; requestCount: number } | null;
  brandsInUse: number;
  topBrand: { name: string; requestCount: number } | null;
};

export interface PurchaseRequestRepositoryPort {
  /**
   * Numbers the request in the condominium (one at a time) and writes it
   * with its items and the notices, in one transaction.
   */
  create(
    condominiumId: string,
    requestedById: string,
    data: PurchaseRequestData,
    notices: (request: PurchaseRequest) => OutboxDraft[],
  ): Promise<PurchaseRequest>;
  /** Replaces the details and the items of an OPEN request. */
  update(id: string, data: PurchaseRequestData): Promise<PurchaseRequest>;
  /**
   * Changes only the priority, place and date of a request
   * in quotes (null: it is no longer in quotes; nothing is written).
   */
  updateDetails(
    id: string,
    data: PurchaseRequestData,
  ): Promise<PurchaseRequest | null>;
  /**
   * Cancels an OPEN request with the notices (null: it is no longer open;
   * nothing is written).
   */
  cancel(
    id: string,
    cancelledBy: string,
    reason: string,
    at: Date,
    notices: OutboxDraft[],
  ): Promise<PurchaseRequest | null>;
  find(condominiumId: string, id: string): Promise<PurchaseRequest | null>;
  /** Newest first. */
  list(
    scope: PurchaseRequestScope,
    filter: PurchaseRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<PurchaseRequest>>;
  filterOptions(
    scope: PurchaseRequestScope,
  ): Promise<PurchaseRequestFilterOptions>;
  catalogUsage(condominiumId: string): Promise<PurchaseCatalogUsage>;
  /** `today` and `soon` are local days ("2026-11-21"). */
  overview(
    scope: PurchaseRequestScope,
    today: string,
    soon: string,
  ): Promise<PurchaseRequestOverview>;
  /** The quote stages in numbers; "below minimum": fewer than minQuotes. */
  quoteBoardOverview(
    condominiumId: string,
    minQuotes: number,
  ): Promise<QuoteBoardOverview>;
}

export const PURCHASE_REQUEST_REPOSITORY = Symbol(
  "PURCHASE_REQUEST_REPOSITORY",
);
