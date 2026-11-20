import { Controller, Inject, Post } from "@nestjs/common";
import { InternalRoute } from "@/common/decorators/internal-route.decorator";
import {
  CleanupUseCase,
  type CleanupReport,
} from "@/modules/maintenance/application/cleanup.use-case";
import { ParcelsMaintenanceService } from "@/modules/parcels/application/parcels-maintenance.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// Called by the scheduled GitHub Actions workflow (CRON_SECRET): the
// cleanup daily, the perishable parcels every few minutes.
@InternalRoute()
@Controller("internal/maintenance")
export class InternalMaintenanceController {
  constructor(
    private readonly cleanup: CleanupUseCase,
    private readonly parcels: ParcelsMaintenanceService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  @Post("cleanup")
  run(): Promise<CleanupReport> {
    return this.cleanup.run();
  }

  @Post("perishable-parcels")
  perishableParcels(): Promise<{ reminders: number; overdue: number }> {
    return this.parcels.runPerishable(this.clock.now());
  }
}
