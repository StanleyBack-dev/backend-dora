import { Args, Int, Query, Resolver } from "@nestjs/graphql";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import type { LandingMetrics } from "@/modules/landing/application/ports/landing-metrics-reader.port";
import { LandingPanelUseCase } from "@/modules/landing/application/use-cases/landing-panel.use-case";
import type { Lead } from "@/modules/landing/domain/landing-lead";
import { LandingLeadPage } from "@/modules/landing/presentation/graphql/dto/outputs/landing-lead-page.output";
import { LandingMetricsType } from "@/modules/landing/presentation/graphql/dto/outputs/landing-metrics.output";
import type { Paginated } from "@/shared/application/pagination";

const DAYS_DESCRIPTION = "Últimos 7, 30, 90 ou 365 dias (padrão: 30).";

// The landing page's panel. CONDOMINIUMS_MANAGE: only the platform
// administrator, like the platform panel.
@Resolver()
export class LandingPanelResolver {
  constructor(private readonly panel: LandingPanelUseCase) {}

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Query(() => LandingMetricsType, {
    description: "Tráfego, engajamento e conversão da landing page.",
  })
  landingMetrics(
    @Args("days", {
      type: () => Int,
      nullable: true,
      description: DAYS_DESCRIPTION,
    })
    days?: number | null,
  ): Promise<LandingMetrics> {
    return this.panel.report(days);
  }

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Query(() => LandingLeadPage, {
    description: "Mensagens recebidas pelo site, das mais recentes.",
  })
  landingLeads(
    @Args("days", {
      type: () => Int,
      nullable: true,
      description: DAYS_DESCRIPTION,
    })
    days?: number | null,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<Lead>> {
    return this.panel.listLeads(days, page ?? { page: 1, limit: 10 });
  }
}
