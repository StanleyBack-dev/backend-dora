import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { tenantOf } from "@/common/auth/tenant";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import {
  PageInput,
  type PaginatedShape,
} from "@/common/graphql/pagination.graphql";
import type { UserGroup } from "@/modules/access-control/domain/user-group";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { UnitsUseCase } from "@/modules/condominiums/application/use-cases/units.use-case";
import { CreateUnitsInput } from "@/modules/condominiums/presentation/graphql/dto/inputs/create-units.input";
import { UpdateUnitInput } from "@/modules/condominiums/presentation/graphql/dto/inputs/update-unit.input";
import { UnitFilterInput } from "@/modules/condominiums/presentation/graphql/dto/inputs/unit-filter.input";
import { UnitType } from "@/modules/condominiums/presentation/graphql/dto/outputs/unit.output";
import {
  UnitWithResidentsPage,
  type UnitWithResidentsType,
} from "@/modules/condominiums/presentation/graphql/dto/outputs/unit-with-residents.output";
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
  @Query(() => UnitWithResidentsPage, {
    description:
      "Página de unidades filtradas, cada uma com as pessoas vinculadas (gestão de Unidades).",
  })
  async unitPage(
    @CurrentUser() user: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: UnitFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedShape<UnitWithResidentsType>> {
    const found = await this.useCase.page(
      tenantOf(user),
      filter ?? {},
      page ?? { page: 1, limit: 20 },
    );
    return {
      ...found,
      items: found.items.map((unit) => ({
        ...toUnitType(unit),
        people: unit.people.map((person) => ({
          ...person,
          role: person.role as UserGroup,
        })),
      })),
    };
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
