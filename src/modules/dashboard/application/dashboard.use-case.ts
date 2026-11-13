import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import {
  DASHBOARD_READER,
  type Dashboard,
  type DashboardReaderPort,
} from "@/modules/dashboard/application/ports/dashboard-reader.port";

// Read-only aggregates across modules (one round trip). Writes and rules
// stay in each module; this only counts. Each new module (bookings…) adds
// its own counters here.
@Injectable()
export class DashboardUseCase {
  constructor(
    @Inject(DASHBOARD_READER) private readonly reader: DashboardReaderPort,
  ) {}

  get(actor: AuthenticatedUser): Promise<Dashboard> {
    return this.reader.read(tenantOf(actor), actor.platformAdmin);
  }
}
