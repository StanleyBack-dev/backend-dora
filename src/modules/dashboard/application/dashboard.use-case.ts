import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import {
  DASHBOARD_READER,
  type Dashboard,
  type DashboardReaderPort,
} from "@/modules/dashboard/application/ports/dashboard-reader.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// Read-only aggregates across modules (one round trip). Writes and rules
// stay in each module; this only counts. Each new module adds its own
// counters here.
@Injectable()
export class DashboardUseCase {
  constructor(
    @Inject(DASHBOARD_READER) private readonly reader: DashboardReaderPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  get(actor: AuthenticatedUser): Promise<Dashboard> {
    const now = this.clock.now();
    // "Today" is the condominium's calendar day, not UTC's.
    const today = {
      from: this.clock.startOfLocalDate(this.clock.localDate(now)),
      to: this.clock.startOfNextLocalDay(now),
    };
    return this.reader.read(tenantOf(actor), actor.platformAdmin, today);
  }
}
