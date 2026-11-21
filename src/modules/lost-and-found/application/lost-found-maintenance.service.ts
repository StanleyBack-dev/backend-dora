import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { expiringNotices } from "@/modules/lost-and-found/application/lost-found-notices";
import { expiredReportNotices } from "@/modules/lost-and-found/application/lost-report-notices";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import {
  LOST_REPORT_REPOSITORY,
  type LostReportRepositoryPort,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import {
  FOUND_ITEM_EXPIRY_NOTICE_DAYS,
  FOUND_ITEM_PHOTO_RETENTION_DAYS,
} from "@/modules/lost-and-found/domain/found-item";
import { LOST_REPORT_KEEP_DAYS } from "@/modules/lost-and-found/domain/lost-report";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

const DAY_MS = 86_400_000;
/** Most notices sent in one run (the next run takes the rest). */
const NOTICES_PER_RUN = 500;

// Daily housekeeping of lost and found: the staff is told once when a kept
// item's keeping period is about to end (only where the module is on), and
// the photos of items that left long ago are deleted, and "Perdi algo"
// reports without news for too long end. Returns and their evidence are
// kept.
@Injectable()
export class LostFoundMaintenanceService {
  private readonly logger = new Logger(LostFoundMaintenanceService.name);

  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    @Inject(LOST_REPORT_REPOSITORY)
    private readonly reports: LostReportRepositoryPort,
    private readonly modules: ModuleAccessService,
    private readonly access: LostFoundAccessService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async run(
    now: Date,
  ): Promise<{ expiring: number; photos: number; lostReports: number }> {
    const [expiring, photos, reportPhotos, lostReports] = await Promise.all([
      this.notifyExpiring(now),
      this.releasePhotos(now),
      this.releaseReportPhotos(now),
      this.expireReports(now),
    ]);
    return { expiring, photos: photos + reportPhotos, lostReports };
  }

  /**
   * "Perdi algo" reports without news for too long end; whoever reported is
   * told (where the module is still on), to report again if still looking.
   */
  private async expireReports(now: Date): Promise<number> {
    const expired = await this.reports.expire(
      new Date(now.getTime() - LOST_REPORT_KEEP_DAYS * DAY_MS),
      now,
    );
    const enabled = new Map<string, boolean>();
    const told = [];
    for (const report of expired) {
      let on = enabled.get(report.condominiumId);
      if (on === undefined) {
        on = (await this.modules.enabled(report.condominiumId)).includes(
          AppModule.LOST_AND_FOUND,
        );
        enabled.set(report.condominiumId, on);
      }
      if (on) told.push(...expiredReportNotices(report));
    }
    if (told.length > 0) await this.reports.notify(told);
    return expired.length;
  }

  private async notifyExpiring(now: Date): Promise<number> {
    const due = await this.items.dueExpiry(
      new Date(now.getTime() + FOUND_ITEM_EXPIRY_NOTICE_DAYS * DAY_MS),
      NOTICES_PER_RUN,
    );
    const enabled = new Map<string, boolean>();
    let sent = 0;
    for (const item of due) {
      let on = enabled.get(item.condominiumId);
      if (on === undefined) {
        on = (await this.modules.enabled(item.condominiumId)).includes(
          AppModule.LOST_AND_FOUND,
        );
        enabled.set(item.condominiumId, on);
      }
      if (!on) continue;
      const staff = await this.access.staff(item.condominiumId);
      const marked = await this.items.markExpiryNotified(
        item.id,
        now,
        expiringNotices(item, staff, this.clock.timeZone),
      );
      if (marked) sent += 1;
    }
    return sent;
  }

  /** "Perdi algo" photos, the same time after the report ended. */
  private async releaseReportPhotos(now: Date): Promise<number> {
    const keys = await this.reports.releasePhotos(
      new Date(now.getTime() - FOUND_ITEM_PHOTO_RETENTION_DAYS * DAY_MS),
    );
    if (keys.length > 0) {
      await this.storage.deleteMany(keys).catch((error) => {
        this.logger.warn(`Lost report photos not removed: ${String(error)}`);
      });
    }
    return keys.length;
  }

  private async releasePhotos(now: Date): Promise<number> {
    const keys = await this.items.releasePhotos(
      new Date(now.getTime() - FOUND_ITEM_PHOTO_RETENTION_DAYS * DAY_MS),
    );
    if (keys.length > 0) {
      await this.storage.deleteMany(keys).catch((error) => {
        this.logger.warn(`Found item photos not removed: ${String(error)}`);
      });
    }
    return keys.length;
  }
}
