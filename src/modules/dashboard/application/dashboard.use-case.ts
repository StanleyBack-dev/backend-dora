import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import {
  DASHBOARD_READER,
  type Dashboard,
  type DashboardReaderPort,
} from "@/modules/dashboard/application/ports/dashboard-reader.port";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { FOUND_ITEM_EXPIRY_NOTICE_DAYS } from "@/modules/lost-and-found/domain/found-item";
import { PARCEL_REMINDER_DAYS } from "@/modules/parcels/domain/parcel";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const DAY_MS = 86_400_000;

// Read-only aggregates across modules (one round trip). Writes and rules
// stay in each module; this only counts. Each new module adds its own
// counters here.
@Injectable()
export class DashboardUseCase {
  constructor(
    @Inject(DASHBOARD_READER) private readonly reader: DashboardReaderPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly modules: ModuleAccessService,
  ) {}

  async get(actor: AuthenticatedUser): Promise<Dashboard> {
    const now = this.clock.now();
    const condominiumId = tenantOf(actor);
    // "Today" is the condominium's calendar day, not UTC's.
    const today = {
      from: this.clock.startOfLocalDate(this.clock.localDate(now)),
      to: this.clock.startOfNextLocalDay(now),
    };
    const [counts, modules] = await Promise.all([
      this.reader.read(condominiumId, actor.platformAdmin, today),
      this.modules.enabled(condominiumId),
    ]);
    // Each module's block only where it is on.
    const [parcels, lostAndFound] = await Promise.all([
      modules.includes(AppModule.PARCELS)
        ? this.reader.parcels(condominiumId, {
            now,
            stuckBefore: new Date(
              now.getTime() - PARCEL_REMINDER_DAYS * DAY_MS,
            ),
            since30Days: new Date(now.getTime() - 30 * DAY_MS),
            timeZone: this.clock.timeZone,
          })
        : null,
      modules.includes(AppModule.LOST_AND_FOUND)
        ? this.reader.lostAndFound(condominiumId, {
            now,
            expiringBefore: new Date(
              now.getTime() + FOUND_ITEM_EXPIRY_NOTICE_DAYS * DAY_MS,
            ),
            since90Days: new Date(now.getTime() - 90 * DAY_MS),
            timeZone: this.clock.timeZone,
          })
        : null,
    ]);
    return { ...counts, parcels, lostAndFound };
  }
}
