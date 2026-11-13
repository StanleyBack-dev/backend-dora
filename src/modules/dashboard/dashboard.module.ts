import { Module } from "@nestjs/common";
import { DASHBOARD_READER } from "@/modules/dashboard/application/ports/dashboard-reader.port";
import { DashboardUseCase } from "@/modules/dashboard/application/dashboard.use-case";
import { DashboardSqlReader } from "@/modules/dashboard/infrastructure/persistence/dashboard-sql.reader";
import { DashboardResolver } from "@/modules/dashboard/presentation/graphql/dashboard.resolver";

// Manager's overview: read-only counts across the app's modules.
@Module({
  providers: [
    DashboardUseCase,
    DashboardResolver,
    { provide: DASHBOARD_READER, useClass: DashboardSqlReader },
  ],
})
export class DashboardModule {}
