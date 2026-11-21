import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { notOwnerNotices } from "@/modules/lost-and-found/application/lost-found-notices";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItem,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  LOST_REPORT_REPOSITORY,
  type LostReportRepositoryPort,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import { isKept, isReserved } from "@/modules/lost-and-found/domain/found-item";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// An item the desk reserved for someone goes to everyone: its owner says
// "Não é meu" (the staff is told), or the desk lifts the reservation. The
// owner's claim given at registration is withdrawn.
@Injectable()
export class ReleaseFoundItemUseCase {
  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    @Inject(LOST_REPORT_REPOSITORY)
    private readonly reports: LostReportRepositoryPort,
    private readonly access: LostFoundAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(actor: AuthenticatedUser, itemId: string): Promise<FoundItem> {
    const item = await this.access.loadVisible(actor, itemId);
    if (!isKept(item.status)) {
      throw AppException.from(APP_ERRORS.lostFound.notKept, undefined);
    }
    if (!isReserved(item)) {
      throw AppException.from(APP_ERRORS.lostFound.notReserved, undefined);
    }
    const desk = await this.access.canManage(actor);
    const owner = await this.access.isOwner(actor, item);
    if (!desk && !owner) {
      throw AppException.from(APP_ERRORS.lostFound.notFound, undefined);
    }
    // The owner saying it is not theirs tells the staff.
    const staff = owner ? await this.access.staff(item.condominiumId) : [];
    const released = await this.items.release(
      item.id,
      actor.id,
      this.clock.now(),
      (changed) =>
        owner
          ? notOwnerNotices(
              changed,
              {
                userId: actor.id,
                name: actor.name ?? "Um morador",
                unitLabel: item.ownerUnitLabel,
              },
              staff,
            )
          : [],
    );
    if (!released) {
      throw AppException.from(APP_ERRORS.lostFound.notReserved, undefined);
    }
    // Registered from a "Perdi algo" report, but not theirs after all: the
    // report goes back to "looking".
    await this.reports.reopenLinkedTo(released.id);
    return released;
  }
}
