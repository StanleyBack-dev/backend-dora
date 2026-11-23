import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import { CancelPurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/cancel-purchase-request.use-case";
import { CreatePurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/create-purchase-request.use-case";
import { ListPurchaseRequestsUseCase } from "@/modules/purchases/application/use-cases/list-purchase-requests.use-case";
import { UpdatePurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/update-purchase-request.use-case";
import { PurchaseRequestFilterInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-request-filter.input";
import { PurchaseRequestInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-request.input";
import { PurchaseRequestFilterOptionsType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request-filter-options.output";
import { PurchaseRequestOverviewType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request-overview.output";
import { PurchaseRequestPage } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request-page.output";
import { PurchaseRequestType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request.output";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { PurchaseCatalogUsageType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-catalog-usage.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

/**
 * Purchase requests (Compras > Solicitações). Who asks for purchases
 * (PURCHASES_REQUEST) sees and edits their own; the management
 * (PURCHASES_MANAGE) every one. Either permission is checked by the use
 * cases (the access service's scope), so one resolver serves both.
 */
@RequireModule(AppModule.PURCHASES)
@Resolver()
export class PurchaseRequestsResolver {
  constructor(
    private readonly listing: ListPurchaseRequestsUseCase,
    private readonly creating: CreatePurchaseRequestUseCase,
    private readonly updating: UpdatePurchaseRequestUseCase,
    private readonly cancelling: CancelPurchaseRequestUseCase,
  ) {}

  @Query(() => PurchaseRequestPage, {
    description:
      "Solicitações de compra (todas para a gestão; as próprias para quem só solicita), as mais novas primeiro.",
  })
  purchaseRequests(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: PurchaseRequestFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<PurchaseRequestType>> {
    return this.listing.list(actor, filter ?? {}, page ?? DEFAULT_PAGE);
  }

  @Query(() => PurchaseRequestType, {
    description: "Uma solicitação de compra.",
  })
  purchaseRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<PurchaseRequestType> {
    return this.listing.get(actor, id);
  }

  @Query(() => PurchaseRequestFilterOptionsType, {
    description:
      "O que os filtros das solicitações oferecem (números, títulos e solicitantes).",
  })
  purchaseRequestFilterOptions(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PurchaseRequestFilterOptionsType> {
    return this.listing.filterOptions(actor);
  }

  @Query(() => PurchaseRequestOverviewType, {
    description: "As solicitações em números (os cards da página).",
  })
  purchaseRequestOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PurchaseRequestOverviewType> {
    return this.listing.overview(actor);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Query(() => PurchaseCatalogUsageType, {
    description:
      "Como os produtos e marcas do catálogo aparecem nas solicitações (cards das páginas do catálogo).",
  })
  purchaseCatalogUsage(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PurchaseCatalogUsageType> {
    return this.listing.catalogUsage(actor);
  }

  @Mutation(() => PurchaseRequestType, {
    description:
      "Faz uma solicitação de compra (numerada no condomínio); a gestão é avisada.",
  })
  createPurchaseRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: PurchaseRequestInput,
  ): Promise<PurchaseRequestType> {
    return this.creating.execute(actor, input);
  }

  @Mutation(() => PurchaseRequestType, {
    description:
      "Altera uma solicitação (dados e itens) enquanto aguarda cotação.",
  })
  updatePurchaseRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: PurchaseRequestInput,
  ): Promise<PurchaseRequestType> {
    return this.updating.execute(actor, id, input);
  }

  @Mutation(() => PurchaseRequestType, {
    description:
      "Cancela uma solicitação que aguarda cotação, com o motivo (quem pediu é avisado quando foi outra pessoa).",
  })
  cancelPurchaseRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<PurchaseRequestType> {
    return this.cancelling.execute(actor, id, reason);
  }
}
