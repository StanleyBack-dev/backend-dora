import { Args, Query, Resolver } from "@nestjs/graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import {
  GetPlatformMetricsUseCase,
  type PlatformMetricsReport,
} from "@/modules/platform-metrics/application/use-cases/get-platform-metrics.use-case";
import { PlatformMetricsFilterInput } from "@/modules/platform-metrics/presentation/graphql/dto/inputs/platform-metrics-filter.input";
import { PlatformMetricsType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/platform-metrics.output";

// The platform panel (Painel). CONDOMINIUMS_MANAGE: only the platform
// administrator; it is never granted to a condominium's managers.
@Resolver()
export class PlatformMetricsResolver {
  constructor(private readonly metrics: GetPlatformMetricsUseCase) {}

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Query(() => PlatformMetricsType, {
    description:
      "Números da plataforma no período: reservas, uso dos espaços, moradores e o que precisa de atenção.",
  })
  platformMetrics(
    @Args("filter", { type: () => PlatformMetricsFilterInput, nullable: true })
    filter: PlatformMetricsFilterInput | null,
  ): Promise<PlatformMetricsReport> {
    return this.metrics.execute(filter ?? {});
  }
}
