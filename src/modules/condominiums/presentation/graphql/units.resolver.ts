import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { tenantOf } from "@/common/auth/tenant";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { UnitsUseCase } from "@/modules/condominiums/application/use-cases/units.use-case";
import { CreateUnitsInput } from "@/modules/condominiums/presentation/graphql/dto/inputs/create-units.input";
import { UpdateUnitInput } from "@/modules/condominiums/presentation/graphql/dto/inputs/update-unit.input";
import { UnitType } from "@/modules/condominiums/presentation/graphql/dto/outputs/unit.output";
import { toUnitType } from "@/modules/condominiums/presentation/graphql/unit.mapper";

@Resolver()
export class UnitsResolver {
  constructor(private readonly useCase: UnitsUseCase) {}

  @Query(() => [UnitType], {
    description: "Unidades do condomínio atual.",
  })
  async units(@CurrentUser() user: AuthenticatedUser): Promise<UnitType[]> {
    return (await this.useCase.list(tenantOf(user))).map(toUnitType);
  }

  @RequirePermissions(Permission.UNITS_MANAGE)
  @Mutation(() => [UnitType], {
    description: "Cria várias unidades de um bloco de uma vez.",
  })
  async createUnits(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateUnitsInput,
  ): Promise<UnitType[]> {
    const created = await this.useCase.create(actor, tenantOf(actor), input);
    return created.map(toUnitType);
  }

  @RequirePermissions(Permission.UNITS_MANAGE)
  @Mutation(() => UnitType)
  async updateUnit(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: UpdateUnitInput,
  ): Promise<UnitType> {
    return toUnitType(
      await this.useCase.update(actor, tenantOf(actor), id, input),
    );
  }

  @RequirePermissions(Permission.UNITS_MANAGE)
  @Mutation(() => Boolean, {
    description: "Exclui a unidade (só sem moradores vinculados).",
  })
  deleteUnit(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<boolean> {
    return this.useCase.remove(tenantOf(actor), id);
  }
}
