import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { ListProductsUseCase } from "@/modules/catalog/application/use-cases/list-products.use-case";
import { SaveProductUseCase } from "@/modules/catalog/application/use-cases/save-product.use-case";
import { CatalogFilterInput } from "@/modules/catalog/presentation/graphql/dto/inputs/catalog-filter.input";
import { ProductInput } from "@/modules/catalog/presentation/graphql/dto/inputs/product.input";
import { CatalogCountsType } from "@/modules/catalog/presentation/graphql/dto/outputs/catalog-counts.output";
import { CatalogOptionType } from "@/modules/catalog/presentation/graphql/dto/outputs/catalog-option.output";
import { ProductPage } from "@/modules/catalog/presentation/graphql/dto/outputs/catalog-pages.output";
import { ProductType } from "@/modules/catalog/presentation/graphql/dto/outputs/product.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

// The catalog's products. Whoever uses the catalog in a module (e.g. asks
// for purchases) reads the select and registers a product from there; who
// manages it there lists, edits and deactivates. The use cases check the
// module and the permissions (CatalogAccessService).
@Resolver()
export class ProductsResolver {
  constructor(
    private readonly listing: ListProductsUseCase,
    private readonly saving: SaveProductUseCase,
  ) {}

  @Query(() => ProductPage, {
    description: "Produtos do catálogo (ativos primeiro, por nome).",
  })
  products(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: CatalogFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<ProductType>> {
    return this.listing.list(actor, filter ?? {}, page ?? DEFAULT_PAGE);
  }

  @Query(() => [CatalogOptionType], {
    description: "Todos os produtos, por nome (selects e filtros).",
  })
  productOptions(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CatalogOptionType[]> {
    return this.listing.options(actor);
  }

  @Query(() => CatalogCountsType, {
    description: "Quantos produtos estão ativos e inativos.",
  })
  productCounts(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CatalogCountsType> {
    return this.listing.counts(actor);
  }

  @Mutation(() => ProductType, {
    description:
      "Cadastra um produto (um nome por condomínio); também ao preencher um item.",
  })
  createProduct(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: ProductInput,
  ): Promise<ProductType> {
    return this.saving.create(actor, input);
  }

  @Mutation(() => ProductType, { description: "Altera um produto." })
  updateProduct(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: ProductInput,
  ): Promise<ProductType> {
    return this.saving.update(actor, id, input);
  }

  @Mutation(() => ProductType, {
    description:
      "Ativa ou desativa um produto (inativo não aparece em novos usos; o histórico fica).",
  })
  setProductActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("active", { type: () => Boolean }) active: boolean,
  ): Promise<ProductType> {
    return this.saving.setActive(actor, id, active);
  }
}
