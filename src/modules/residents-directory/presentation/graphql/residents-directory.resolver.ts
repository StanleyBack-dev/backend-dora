import { Args, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import {
  ListResidentsUseCase,
  type ResidentListing,
} from "@/modules/residents-directory/application/use-cases/list-residents.use-case";
import { ResidentsFilterInput } from "@/modules/residents-directory/presentation/graphql/dto/inputs/residents-filter.input";
import { ResidentListingPage } from "@/modules/residents-directory/presentation/graphql/dto/outputs/resident-listing-page.output";
import { ResidentNameType } from "@/modules/residents-directory/presentation/graphql/dto/outputs/resident-name.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

// The residents' directory, read only (RESIDENTS_READ): the gate and the
// managers find who lives where and how to reach them.
@Resolver()
export class ResidentsDirectoryResolver {
  constructor(private readonly listing: ListResidentsUseCase) {}

  @RequirePermissions(Permission.RESIDENTS_READ)
  @Query(() => ResidentListingPage, {
    description:
      "Moradores ativos do condomínio, por nome, com filtros e por página (somente leitura).",
  })
  residentsDirectory(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: ResidentsFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<ResidentListing>> {
    return this.listing.list(
      actor,
      { userId: filter?.userId, unitId: filter?.unitId },
      page ?? DEFAULT_PAGE,
    );
  }

  @RequirePermissions(Permission.RESIDENTS_READ)
  @Query(() => [ResidentNameType], {
    description: "Os nomes dos moradores, para o filtro da consulta.",
  })
  residentNames(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ResidentNameType[]> {
    return this.listing.names(actor);
  }
}
