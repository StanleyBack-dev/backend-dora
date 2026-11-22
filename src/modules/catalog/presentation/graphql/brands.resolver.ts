import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { ListBrandsUseCase } from "@/modules/catalog/application/use-cases/list-brands.use-case";
import { SaveBrandUseCase } from "@/modules/catalog/application/use-cases/save-brand.use-case";
import { CatalogFilterInput } from "@/modules/catalog/presentation/graphql/dto/inputs/catalog-filter.input";
import { BrandType } from "@/modules/catalog/presentation/graphql/dto/outputs/brand.output";
import { CatalogCountsType } from "@/modules/catalog/presentation/graphql/dto/outputs/catalog-counts.output";
import { CatalogOptionType } from "@/modules/catalog/presentation/graphql/dto/outputs/catalog-option.output";
import { BrandPage } from "@/modules/catalog/presentation/graphql/dto/outputs/catalog-pages.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

// The catalog's brands, as its products: whoever uses the catalog reads the
// select and registers a brand from there; who manages it lists, renames
// and deactivates (checked by the use cases).
@Resolver()
export class BrandsResolver {
  constructor(
    private readonly listing: ListBrandsUseCase,
    private readonly saving: SaveBrandUseCase,
  ) {}

  @Query(() => BrandPage, {
    description: "Marcas do catálogo (ativas primeiro, por nome).",
  })
  brands(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: CatalogFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<BrandType>> {
    return this.listing.list(actor, filter ?? {}, page ?? DEFAULT_PAGE);
  }

  @Query(() => [CatalogOptionType], {
    description: "Todas as marcas, por nome (selects e filtros).",
  })
  brandOptions(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CatalogOptionType[]> {
    return this.listing.options(actor);
  }

  @Query(() => CatalogCountsType, {
    description: "Quantas marcas estão ativas e inativas.",
  })
  brandCounts(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CatalogCountsType> {
    return this.listing.counts(actor);
  }

  @Mutation(() => BrandType, {
    description:
      "Cadastra uma marca (um nome por condomínio); também ao preencher um item.",
  })
  createBrand(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("name") name: string,
  ): Promise<BrandType> {
    return this.saving.create(actor, name);
  }

  @Mutation(() => BrandType, { description: "Renomeia uma marca." })
  renameBrand(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("name") name: string,
  ): Promise<BrandType> {
    return this.saving.rename(actor, id, name);
  }

  @Mutation(() => BrandType, {
    description:
      "Ativa ou desativa uma marca (inativa não aparece em novos usos; o histórico fica).",
  })
  setBrandActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("active", { type: () => Boolean }) active: boolean,
  ): Promise<BrandType> {
    return this.saving.setActive(actor, id, active);
  }
}
