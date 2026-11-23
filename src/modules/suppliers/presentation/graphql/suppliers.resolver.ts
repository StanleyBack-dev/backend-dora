import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { CreateSupplierUseCase } from "@/modules/suppliers/application/use-cases/create-supplier.use-case";
import { ListSuppliersUseCase } from "@/modules/suppliers/application/use-cases/list-suppliers.use-case";
import { SetSupplierActiveUseCase } from "@/modules/suppliers/application/use-cases/set-supplier-active.use-case";
import { UpdateSupplierUseCase } from "@/modules/suppliers/application/use-cases/update-supplier.use-case";
import { SupplierFilterInput } from "@/modules/suppliers/presentation/graphql/dto/inputs/supplier-filter.input";
import { SupplierInput } from "@/modules/suppliers/presentation/graphql/dto/inputs/supplier.input";
import { SupplierFilterOptionsType } from "@/modules/suppliers/presentation/graphql/dto/outputs/supplier-filter-options.output";
import { SupplierOverviewType } from "@/modules/suppliers/presentation/graphql/dto/outputs/supplier-overview.output";
import { SupplierOptionType } from "@/modules/suppliers/presentation/graphql/dto/outputs/supplier-option.output";
import { SupplierPage } from "@/modules/suppliers/presentation/graphql/dto/outputs/supplier-page.output";
import { SupplierType } from "@/modules/suppliers/presentation/graphql/dto/outputs/supplier.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

// The condominium's suppliers (Compras > Fornecedores): who it buys from
// or hires. The use cases check the module and the permission
// (SuppliersAccessService), so other modules can work with suppliers too.
@Resolver()
export class SuppliersResolver {
  constructor(
    private readonly listing: ListSuppliersUseCase,
    private readonly creating: CreateSupplierUseCase,
    private readonly updating: UpdateSupplierUseCase,
    private readonly activating: SetSupplierActiveUseCase,
  ) {}

  @Query(() => SupplierPage, {
    description: "Fornecedores do condomínio (ativos primeiro, por nome).",
  })
  suppliers(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: SupplierFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<SupplierType>> {
    return this.listing.list(actor, filter ?? {}, page ?? DEFAULT_PAGE);
  }

  @Query(() => [SupplierOptionType], {
    description:
      "Os fornecedores ativos, por nome, com o que atendem (ex.: para cotar uma compra).",
  })
  supplierOptions(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<SupplierOptionType[]> {
    return this.listing.activeOptions(actor);
  }

  @Query(() => SupplierFilterOptionsType, {
    description:
      "O que os filtros dos fornecedores oferecem (nomes, contatos e CNPJ/CPF em uso).",
  })
  supplierFilterOptions(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<SupplierFilterOptionsType> {
    return this.listing.filterOptions(actor);
  }

  @Query(() => SupplierOverviewType, {
    description: "Os fornecedores em números (os cards da página).",
  })
  supplierOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<SupplierOverviewType> {
    return this.listing.overview(actor);
  }

  @Query(() => SupplierType, { description: "Um fornecedor do condomínio." })
  supplier(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<SupplierType> {
    return this.listing.get(actor, id);
  }

  @Mutation(() => SupplierType, { description: "Cadastra um fornecedor." })
  createSupplier(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: SupplierInput,
  ): Promise<SupplierType> {
    return this.creating.execute(actor, input);
  }

  @Mutation(() => SupplierType, { description: "Altera um fornecedor." })
  updateSupplier(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: SupplierInput,
  ): Promise<SupplierType> {
    return this.updating.execute(actor, id, input);
  }

  @Mutation(() => SupplierType, {
    description:
      "Ativa ou desativa um fornecedor (inativo não entra em novas cotações; o histórico fica).",
  })
  setSupplierActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("active", { type: () => Boolean }) active: boolean,
  ): Promise<SupplierType> {
    return this.activating.execute(actor, id, active);
  }
}
