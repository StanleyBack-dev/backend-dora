import { Module } from "@nestjs/common";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { PLATFORM_METRICS_READER } from "@/modules/platform-metrics/application/ports/platform-metrics-reader.port";
import { GetPlatformMetricsUseCase } from "@/modules/platform-metrics/application/use-cases/get-platform-metrics.use-case";
import { PlatformMetricsSqlReader } from "@/modules/platform-metrics/infrastructure/persistence/platform-metrics-sql.reader";
import { PlatformMetricsResolver } from "@/modules/platform-metrics/presentation/graphql/platform-metrics.resolver";

// The platform administrator's panel: read-only numbers across the app.
@Module({
  imports: [CondominiumsModule],
  providers: [
    GetPlatformMetricsUseCase,
    PlatformMetricsResolver,
    { provide: PLATFORM_METRICS_READER, useClass: PlatformMetricsSqlReader },
  ],
})
export class PlatformMetricsModule {}
