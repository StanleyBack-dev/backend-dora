import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { GraphQLModule } from "@nestjs/graphql";
import type { ApolloDriverConfig } from "@nestjs/apollo";
import { AppController } from "@/app.controller";
import { AppResolver } from "@/app.resolver";
import { HttpExceptionFilter } from "@/common/filters/http-exception.filter";
import { buildGraphqlConfig } from "@/common/graphql/graphql.config";
import { InternalApiKeyGuard } from "@/common/security/internal-api-key.guard";
import { AppConfigModule } from "@/config/config.module";
import { DatabaseModule } from "@/database/database.module";
import { EnrollmentModule } from "@/modules/enrollment/enrollment.module";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { PermissionsGuard } from "@/modules/access-control/presentation/guards/permissions.guard";
import { ModuleGuard } from "@/modules/condominiums/presentation/guards/module.guard";
import { AuditModule } from "@/modules/audit/audit.module";
import { BookingsModule } from "@/modules/bookings/bookings.module";
import { BroadcastsModule } from "@/modules/broadcasts/broadcasts.module";
import { SupportModule } from "@/modules/support/support.module";
import { SystemLogsModule } from "@/modules/system-logs/system-logs.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { DashboardModule } from "@/modules/dashboard/dashboard.module";
import { PlatformDirectoryModule } from "@/modules/platform-directory/platform-directory.module";
import { PlatformMetricsModule } from "@/modules/platform-metrics/platform-metrics.module";
import { SupportersModule } from "@/modules/supporters/supporters.module";
import { EventsModule } from "@/modules/events/events.module";
import { DependentsModule } from "@/modules/dependents/dependents.module";
import { AppInfoModule } from "@/modules/app-info/app-info.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { FirstAccessGuard } from "@/modules/identity/presentation/guards/first-access.guard";
import { UserSessionGuard } from "@/modules/identity/presentation/guards/user-session.guard";
import { LandingModule } from "@/modules/landing/landing.module";
import { MailModule } from "@/modules/mails/mail.module";
import { MaintenanceModule } from "@/modules/maintenance/maintenance.module";
import { NotificationsModule } from "@/modules/notifications/notifications.module";
import { ProfilePhotosModule } from "@/modules/profile-photos/profile-photos.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { LostAndFoundModule } from "@/modules/lost-and-found/lost-and-found.module";
import { PurchasesModule } from "@/modules/purchases/purchases.module";
import { ParcelsModule } from "@/modules/parcels/parcels.module";
import { ResidentsDirectoryModule } from "@/modules/residents-directory/residents-directory.module";
import { SpacesModule } from "@/modules/spaces/spaces.module";
import { SharedModule } from "@/shared/shared.module";

@Module({
  controllers: [AppController],
  imports: [
    AppConfigModule,
    DatabaseModule,
    GraphQLModule.forRoot<ApolloDriverConfig>(buildGraphqlConfig()),
    SharedModule,
    MailModule,
    AuditModule,
    AccessControlModule,
    CondominiumsModule,
    IdentityModule,
    EnrollmentModule,
    SpacesModule,
    BookingsModule,
    ParcelsModule,
    LostAndFoundModule,
    PurchasesModule,
    ResidentsDirectoryModule,
    ProfilePhotosModule,
    OutboxModule,
    NotificationsModule,
    BroadcastsModule,
    SupportModule,
    SystemLogsModule,
    DashboardModule,
    PlatformMetricsModule,
    PlatformDirectoryModule,
    SupportersModule,
    EventsModule,
    DependentsModule,
    AppInfoModule,
    MaintenanceModule,
    LandingModule,
  ],
  providers: [
    AppResolver,
    // Global guards run in this order: BFF key → session (sets
    // request.user) → first access (temporary password) → permissions →
    // contracted modules.
    { provide: APP_GUARD, useClass: InternalApiKeyGuard },
    { provide: APP_GUARD, useExisting: UserSessionGuard },
    { provide: APP_GUARD, useExisting: FirstAccessGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
    { provide: APP_GUARD, useExisting: ModuleGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
