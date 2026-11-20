import { Inject, Injectable, Logger } from "@nestjs/common";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { reminderNotices } from "@/modules/parcels/application/parcel-notices";
import {
  PARCEL_REPOSITORY,
  type ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import {
  PARCEL_PHOTO_RETENTION_DAYS,
  PARCEL_REMINDER_DAYS,
} from "@/modules/parcels/domain/parcel";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

const DAY_MS = 86_400_000;
/** Most reminders sent in one run (the next run takes the rest). */
const REMINDERS_PER_RUN = 500;

// Daily housekeeping of the parcels module: residents are reminded once of
// a parcel waiting at the gate for days (only where the module is on), and
// the photos of parcels that left the gate long ago are deleted. The
// signatures and their evidence are kept.
@Injectable()
export class ParcelsMaintenanceService {
  private readonly logger = new Logger(ParcelsMaintenanceService.name);

  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
    private readonly modules: ModuleAccessService,
    private readonly access: ParcelAccessService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async run(now: Date): Promise<{ reminders: number; photos: number }> {
    const [reminders, photos] = await Promise.all([
      this.remind(now),
      this.releasePhotos(now),
    ]);
    return { reminders, photos };
  }

  private async remind(now: Date): Promise<number> {
    const due = await this.parcels.dueReminders(
      new Date(now.getTime() - PARCEL_REMINDER_DAYS * DAY_MS),
      REMINDERS_PER_RUN,
    );
    const enabled = new Map<string, boolean>();
    let sent = 0;
    for (const parcel of due) {
      if (!parcel.unitId) continue;
      let on = enabled.get(parcel.condominiumId);
      if (on === undefined) {
        on = (await this.modules.enabled(parcel.condominiumId)).includes(
          AppModule.PARCELS,
        );
        enabled.set(parcel.condominiumId, on);
      }
      if (!on) continue;
      const residents = await this.access.audience(parcel);
      const marked = await this.parcels.markReminded(
        parcel.id,
        now,
        reminderNotices(parcel, residents, this.clock.timeZone),
      );
      if (marked) sent += 1;
    }
    return sent;
  }

  private async releasePhotos(now: Date): Promise<number> {
    const keys = await this.parcels.releasePhotos(
      new Date(now.getTime() - PARCEL_PHOTO_RETENTION_DAYS * DAY_MS),
    );
    if (keys.length > 0) {
      await this.storage.deleteMany(keys).catch((error) => {
        this.logger.warn(`Parcel photos not removed: ${String(error)}`);
      });
    }
    return keys.length;
  }
}
