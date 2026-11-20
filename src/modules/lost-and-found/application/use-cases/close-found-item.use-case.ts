import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { decidedNotices } from "@/modules/lost-and-found/application/lost-found-notices";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItem,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  FoundItemStatus,
  isKept,
  normalizeNote,
} from "@/modules/lost-and-found/domain/found-item";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const NOTES = {
  [FoundItemStatus.DONATED]: "O item foi doado pelo condomínio.",
  [FoundItemStatus.DISCARDED]: "O item foi descartado pelo condomínio.",
} as const;

// Nobody took it back (usually after the keeping period): the staff records
// that it was donated or discarded, with the reason. Open claims are
// rejected and their residents told, in the same transaction.
@Injectable()
export class CloseFoundItemUseCase {
  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    private readonly access: LostFoundAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    status: FoundItemStatus.DONATED | FoundItemStatus.DISCARDED,
    reason: string,
  ): Promise<FoundItem> {
    const item = await this.access.loadVisible(actor, id);
    if (!isKept(item.status)) {
      throw AppException.from(APP_ERRORS.lostFound.notKept, undefined);
    }
    const why = normalizeNote(reason);
    if (!why) {
      throw AppException.from(APP_ERRORS.lostFound.invalidNote, undefined);
    }
    const closed = await this.items.close(
      item.id,
      { status, reason: why, by: actor.id, at: this.clock.now() },
      NOTES[status],
      (_updated, rejected) => rejected.flatMap(decidedNotices),
    );
    if (!closed) {
      throw AppException.from(APP_ERRORS.lostFound.notKept, undefined);
    }
    return closed;
  }
}
