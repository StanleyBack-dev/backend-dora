import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { CondominiumsUseCase } from "@/modules/condominiums/application/use-cases/condominiums.use-case";
import type { CondominiumSummary } from "@/modules/condominiums/application/ports/condominium-repository.port";
import { CondominiumStatus } from "@/modules/condominiums/domain/condominium";
import { CondominiumType } from "@/modules/condominiums/presentation/graphql/dto/outputs/condominium.output";
import { CondominiumInput } from "@/modules/condominiums/presentation/graphql/dto/inputs/condominium.input";
import { CondominiumFilterInput } from "@/modules/condominiums/presentation/graphql/dto/inputs/condominium-filter.input";
import "@/modules/condominiums/presentation/graphql/condominiums.graphql-enums";

@Resolver()
export class CondominiumsResolver {
  constructor(private readonly useCase: CondominiumsUseCase) {}

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Query(() => [CondominiumType])
  condominiums(
    @Args("filter", { nullable: true }) filter?: CondominiumFilterInput,
  ): Promise<CondominiumSummary[]> {
    return this.useCase.list(filter ?? {});
  }

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Query(() => CondominiumType)
  condominium(
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<CondominiumSummary> {
    return this.useCase.get(id);
  }

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Mutation(() => CondominiumType)
  createCondominium(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CondominiumInput,
  ): Promise<CondominiumSummary> {
    return this.useCase.create(actor, input);
  }

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Mutation(() => CondominiumType)
  updateCondominium(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: CondominiumInput,
  ): Promise<CondominiumSummary> {
    return this.useCase.update(actor, id, input);
  }

  @RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
  @Mutation(() => CondominiumType, {
    description: "Suspende ou reativa. Suspenso, ninguém trabalha nele.",
  })
  setCondominiumStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("status", { type: () => CondominiumStatus })
    status: CondominiumStatus,
  ): Promise<CondominiumSummary> {
    return this.useCase.setStatus(actor, id, status);
  }
}
