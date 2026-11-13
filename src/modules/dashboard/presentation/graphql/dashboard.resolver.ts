import { Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { DashboardUseCase } from "@/modules/dashboard/application/dashboard.use-case";
import { type Dashboard } from "@/modules/dashboard/application/ports/dashboard-reader.port";
import { DashboardType } from "@/modules/dashboard/presentation/graphql/dto/outputs/dashboard.output";

@Resolver()
export class DashboardResolver {
  constructor(private readonly dashboardUseCase: DashboardUseCase) {}

  @RequirePermissions(Permission.DASHBOARD_READ)
  @Query(() => DashboardType)
  dashboard(@CurrentUser() actor: AuthenticatedUser): Promise<Dashboard> {
    return this.dashboardUseCase.get(actor);
  }
}
