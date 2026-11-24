import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseCatalogUsage,
  type PurchaseRequestFilter,
  type PurchaseRequestFilterOptions,
  type PurchaseRequestOverview,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import type { PurchaseRequest } from "@/modules/purchases/domain/purchase-request";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { addDays, toLocalDate } from "@/shared/domain/local-date";

/** "Prazo próximo": needed within this many days. */
const DUE_SOON_DAYS = 7;

/**
 * The purchase requests the caller sees (every one for the management,
 * their own otherwise), filtered and paged here; one of them; what the
 * filters offer; and the numbers of the page's cards.
 */
@Injectable()
export class ListPurchaseRequestsUseCase {
  constructor(
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    private readonly access: PurchasesAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async list(
    actor: AuthenticatedUser,
    filter: PurchaseRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<PurchaseRequest>> {
    return this.requests.list(await this.access.scopeOf(actor), filter, page);
  }

  get(actor: AuthenticatedUser, id: string): Promise<PurchaseRequest> {
    return this.access.loadRequest(actor, id);
  }

  async filterOptions(
    actor: AuthenticatedUser,
  ): Promise<PurchaseRequestFilterOptions> {
    return this.requests.filterOptions(await this.access.scopeOf(actor));
  }

  /** How the catalog is used by the requests (the resolver checks the management). */
  async catalogUsage(actor: AuthenticatedUser): Promise<PurchaseCatalogUsage> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.requests.catalogUsage(condominiumId);
  }

  async overview(actor: AuthenticatedUser): Promise<PurchaseRequestOverview> {
    const scope = await this.access.scopeOf(actor);
    const today = toLocalDate(this.clock.now(), this.clock.timeZone);
    return this.requests.overview(scope, today, addDays(today, DUE_SOON_DAYS));
  }
}
