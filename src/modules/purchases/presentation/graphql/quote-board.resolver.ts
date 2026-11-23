import { Args, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import {
  ListQuoteBoardUseCase,
  type QuoteBoardRow,
} from "@/modules/purchases/application/use-cases/list-quote-board.use-case";
import { PurchaseRequestFilterInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-request-filter.input";
import {
  QuoteBoardOverviewType,
  QuoteBoardPage,
} from "@/modules/purchases/presentation/graphql/dto/outputs/quote-board.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

/**
 * The quotes page (Compras > Cotações, management only): the requests in
 * the quote stages with how their quotes stand, and the page's cards.
 */
@RequireModule(AppModule.PURCHASES)
@RequirePermissions(Permission.PURCHASES_MANAGE)
@Resolver()
export class QuoteBoardResolver {
  constructor(private readonly board: ListQuoteBoardUseCase) {}

  @Query(() => QuoteBoardPage, {
    description:
      "Solicitações aguardando cotação, em cotação, aguardando aprovação, aprovadas ou reprovadas, com o andamento das cotações.",
  })
  quoteBoard(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: PurchaseRequestFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<QuoteBoardRow>> {
    return this.board.list(actor, filter ?? {}, page ?? DEFAULT_PAGE);
  }

  @Query(() => QuoteBoardOverviewType, {
    description: "As cotações em números (os cards da página).",
  })
  quoteBoardOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<QuoteBoardOverviewType> {
    return this.board.overview(actor);
  }
}
