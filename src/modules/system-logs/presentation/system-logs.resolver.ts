import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { SystemLogsService } from "@/modules/system-logs/application/system-logs.service";
import type {
  SystemLogSummary,
  SystemLogView,
} from "@/modules/system-logs/application/ports/system-log-repository.port";
import type { Paginated as PaginatedResult } from "@/shared/application/pagination";
import { SystemLogSummaryType } from "@/modules/system-logs/presentation/dto/outputs/system-log-summary.output";
import { SystemLogPage } from "@/modules/system-logs/presentation/dto/outputs/system-log-page.output";
import { SystemLogFilterInput } from "@/modules/system-logs/presentation/dto/inputs/system-log-filter.input";

@Resolver()
export class SystemLogsResolver {
  constructor(private readonly logs: SystemLogsService) {}

  @RequirePermissions(Permission.AUDIT_READ)
  @Query(() => SystemLogPage, {
    description: "Log do sistema (administração), do mais recente.",
  })
  systemLogs(
    @Args("filter", { nullable: true }) filter?: SystemLogFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<SystemLogView>> {
    return this.logs.list(filter ?? {}, page ?? { page: 1, limit: 20 });
  }

  @RequirePermissions(Permission.AUDIT_READ)
  @Query(() => [SystemLogSummaryType], {
    description: "Quantos registros por nível nas últimas 24 h e 7 dias.",
  })
  systemLogSummary(): Promise<SystemLogSummary[]> {
    return this.logs.summary();
  }

  @Mutation(() => Boolean, {
    description:
      "Erro de tela do app (o frontend avisa para o log do sistema).",
  })
  async reportClientError(
    @CurrentUser() user: AuthenticatedUser,
    @Args("message") message: string,
    @Args("url") url: string,
    @Args("digest", { type: () => String, nullable: true })
    digest: string | null,
  ): Promise<boolean> {
    await this.logs.record({
      level: "ERROR",
      category: "FRONTEND",
      source: `Tela ${url.slice(0, 150)}`,
      message: message.slice(0, 1000),
      details: {
        url: url.slice(0, 300),
        digest: digest?.slice(0, 100) ?? null,
      },
      userId: user.id,
      ip: user.ipAddress,
      alert: true,
    });
    return true;
  }
}
