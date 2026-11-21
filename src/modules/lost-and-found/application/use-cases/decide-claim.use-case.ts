import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { decidedNotices } from "@/modules/lost-and-found/application/lost-found-notices";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItemClaim,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  ClaimStatus,
  isKept,
  normalizeNote,
  optionalText,
} from "@/modules/lost-and-found/domain/found-item";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/** Longest note of an answer (characters). */
const NOTE_MAX = 300;

// The staff checks a claim against what only it knows about the item:
// accepted, the resident is told to come and take it (signing on the
// screen), with an optional note; rejected, they are told why (a reason
// is required). Nobody answers their own claim (a staff member who lost
// something waits for a colleague).
@Injectable()
export class DecideClaimUseCase {
  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    private readonly access: LostFoundAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    claimId: string,
    accept: boolean,
    note: string | null | undefined,
  ): Promise<FoundItemClaim> {
    const condominiumId = await this.access.condominiumOf(actor);
    const claim = await this.items.findClaim(condominiumId, claimId);
    if (!claim) {
      throw AppException.from(APP_ERRORS.lostFound.claimNotFound, undefined);
    }
    if (!isKept(claim.itemStatus)) {
      throw AppException.from(APP_ERRORS.lostFound.notKept, undefined);
    }
    if (claim.userId === actor.id) {
      throw AppException.from(APP_ERRORS.lostFound.ownClaim, undefined);
    }
    // Accepting: an optional note of any length up to 300 ("ok", "amanhã");
    // rejecting: the reason, 3 to 300 characters.
    const text = accept ? optionalText(note, NOTE_MAX) : normalizeNote(note);
    if (text === undefined || (!accept && !text)) {
      throw AppException.from(APP_ERRORS.lostFound.invalidNote, undefined);
    }
    const decided = await this.items.decideClaim(
      claim.id,
      {
        status: accept ? ClaimStatus.ACCEPTED : ClaimStatus.REJECTED,
        note: text,
        by: actor.id,
        at: this.clock.now(),
      },
      decidedNotices,
    );
    if (!decided) {
      throw AppException.from(APP_ERRORS.lostFound.claimNotPending, undefined);
    }
    return decided;
  }
}
