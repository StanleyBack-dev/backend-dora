import { Field, Int, ObjectType, Query, Resolver } from "@nestjs/graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import {
  DashboardUseCase,
  type Dashboard,
} from "@/modules/dashboard/application/dashboard";

@ObjectType("Dashboard", { description: "Painel do gestor." })
class DashboardType implements Dashboard {
  @Field(() => Int, { description: "Contas ativas." })
  activeUsers!: number;

  @Field(() => Int, { description: "Cadastros aguardando aprovação." })
  pendingEnrollments!: number;

  @Field(() => Int, { description: "Pedidos de suporte sem resposta." })
  openSupportRequests!: number;

  @Field(() => Int, { description: "Notificações que falharam de vez." })
  failedNotifications!: number;
}

@Resolver()
export class DashboardResolver {
  constructor(private readonly dashboardUseCase: DashboardUseCase) {}

  @RequirePermissions(Permission.DASHBOARD_READ)
  @Query(() => DashboardType)
  dashboard(): Promise<Dashboard> {
    return this.dashboardUseCase.get();
  }
}
