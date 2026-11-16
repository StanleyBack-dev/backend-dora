import { Args, ID, Mutation, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import type { CondominiumSummary } from "@/modules/condominiums/application/ports/condominium-repository.port";
import { CondominiumsUseCase } from "@/modules/condominiums/application/use-cases/condominiums.use-case";
import { SetCondominiumModuleUseCase } from "@/modules/condominiums/application/use-cases/set-condominium-module.use-case";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { CondominiumType } from "@/modules/condominiums/presentation/graphql/dto/outputs/condominium.output";
import "@/modules/condominiums/presentation/graphql/condominiums.graphql-enums";

// Optional modules contracted by each condominium: the platform only.
@Resolver()
export class CondominiumModulesResolver {
  constructor(
    private readonly setting: SetCondominiumModuleUseCase,
    private readonly condominiums: CondominiumsUseCase,
  ) {}

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Mutation(() => CondominiumType, {
    description:
      "Liga ou desliga um módulo contratado à parte (ex.: Eventos) no condomínio.",
  })
  async setCondominiumModule(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("module", { type: () => AppModule }) module: AppModule,
    @Args("enabled") enabled: boolean,
  ): Promise<CondominiumSummary> {
    await this.setting.execute(actor, id, module, enabled);
    return this.condominiums.get(id);
  }
}
