import { Module } from "@nestjs/common";
import { BookingsModule } from "@/modules/bookings/bookings.module";
import { EventsModule } from "@/modules/events/events.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { CleanupUseCase } from "@/modules/maintenance/application/cleanup.use-case";
import { InternalMaintenanceController } from "@/modules/maintenance/presentation/rest/internal-maintenance.controller";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { LostAndFoundModule } from "@/modules/lost-and-found/lost-and-found.module";
import { ParcelsModule } from "@/modules/parcels/parcels.module";
import { SystemLogsModule } from "@/modules/system-logs/system-logs.module";

// Scheduled housekeeping (internal routes only, no GraphQL).
@Module({
  imports: [
    BookingsModule,
    EventsModule,
    IdentityModule,
    NotificationsModule,
    OutboxModule,
    ParcelsModule,
    LostAndFoundModule,
    SystemLogsModule,
  ],
  controllers: [InternalMaintenanceController],
  providers: [CleanupUseCase],
})
export class MaintenanceModule {}
