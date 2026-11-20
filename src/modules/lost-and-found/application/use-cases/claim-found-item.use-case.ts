import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { claimedNotices } from "@/modules/lost-and-found/application/lost-found-notices";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItemClaim,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  ClaimStatus,
  isKept,
  normalizeClaimMessage,
} from "@/modules/lost-and-found/domain/found-item";

// A resident says a kept item is theirs, describing it (colour, brand, what
// is inside…) so the staff can compare with the details only it sees. One
// open claim per person and item; a pending one can be withdrawn. The staff
// is told in the same transaction.
@Injectable()
export class ClaimFoundItemUseCase {
  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    private readonly access: LostFoundAccessService,
  ) {}

  async claim(
    actor: AuthenticatedUser,
    itemId: string,
    message: string,
  ): Promise<FoundItemClaim> {
    const item = await this.access.loadVisible(actor, itemId);
    if (!isKept(item.status)) {
      throw AppException.from(APP_ERRORS.lostFound.notKept, undefined);
    }
    const text = normalizeClaimMessage(message);
    if (!text) {
      throw AppException.from(APP_ERRORS.lostFound.invalidClaim, undefined);
    }
    const staff = (await this.access.staff(item.condominiumId)).filter(
      (userId) => userId !== actor.id,
    );
    const claim = await this.items.claim(item.id, actor.id, text, (created) =>
      claimedNotices(created, staff),
    );
    if (claim) return claim;
    // Not inserted: it left the desk meanwhile, or one is already open.
    const again = await this.access.loadVisible(actor, itemId);
    if (!isKept(again.status)) {
      throw AppException.from(APP_ERRORS.lostFound.notKept, undefined);
    }
    throw AppException.from(APP_ERRORS.lostFound.claimExists, undefined);
  }

  async withdraw(
    actor: AuthenticatedUser,
    claimId: string,
  ): Promise<FoundItemClaim> {
    const condominiumId = await this.access.condominiumOf(actor);
    const claim = await this.items.findClaim(condominiumId, claimId);
    if (!claim || claim.userId !== actor.id) {
      throw AppException.from(APP_ERRORS.lostFound.claimNotFound, undefined);
    }
    if (!(await this.items.withdrawClaim(claim.id, actor.id))) {
      throw AppException.from(APP_ERRORS.lostFound.claimNotPending, undefined);
    }
    return { ...claim, status: ClaimStatus.WITHDRAWN };
  }
}
