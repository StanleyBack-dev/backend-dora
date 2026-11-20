import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItem,
  type FoundItemClaim,
  type FoundItemFilter,
  type FoundItemOverview,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  FOUND_ITEM_EXPIRY_NOTICE_DAYS,
  type FoundItemCategory,
} from "@/modules/lost-and-found/domain/found-item";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const DAY_MS = 86_400_000;

// The condominium's found items for the desk (filtered and paged by the
// database), their numbers, an item's claims; what residents browse (items
// still kept) and their own claims.
@Injectable()
export class ListFoundItemsUseCase {
  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    private readonly access: LostFoundAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async all(
    actor: AuthenticatedUser,
    filter: FoundItemFilter,
    page: PageRequest,
  ): Promise<Paginated<FoundItem>> {
    return this.items.list(
      await this.access.condominiumOf(actor),
      filter,
      page,
    );
  }

  async overview(actor: AuthenticatedUser): Promise<FoundItemOverview> {
    const condominiumId = await this.access.condominiumOf(actor);
    const expiringBefore = new Date(
      this.clock.now().getTime() + FOUND_ITEM_EXPIRY_NOTICE_DAYS * DAY_MS,
    );
    return this.items.overview(condominiumId, expiringBefore);
  }

  /** What residents browse: the items still kept. */
  async kept(
    actor: AuthenticatedUser,
    category: FoundItemCategory | null,
    page: PageRequest,
  ): Promise<Paginated<FoundItem>> {
    return this.items.listKept(
      await this.access.condominiumOf(actor),
      category,
      page,
    );
  }

  /** The caller's claims, newest first. */
  async myClaims(
    actor: AuthenticatedUser,
    page: PageRequest,
  ): Promise<Paginated<FoundItemClaim>> {
    return this.items.claimsBy(
      await this.access.condominiumOf(actor),
      actor.id,
      page,
    );
  }

  /** An item's claims (the desk). */
  async claimsOf(
    actor: AuthenticatedUser,
    itemId: string,
  ): Promise<FoundItemClaim[]> {
    const item = await this.access.loadVisible(actor, itemId);
    return this.items.claimsOf(item.id);
  }
}
