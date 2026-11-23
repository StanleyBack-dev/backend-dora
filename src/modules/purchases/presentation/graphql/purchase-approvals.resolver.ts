import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import type { ApprovalOverview } from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import { DecidePurchaseApprovalUseCase } from "@/modules/purchases/application/use-cases/decide-purchase-approval.use-case";
import { ListPurchaseApprovalsUseCase } from "@/modules/purchases/application/use-cases/list-purchase-approvals.use-case";
import type { QuoteBoardRow } from "@/modules/purchases/application/use-cases/list-quote-board.use-case";
import { PurchaseSummaryPdfUseCase } from "@/modules/purchases/application/use-cases/purchase-summary-pdf.use-case";
import { PurchaseSettingsUseCase } from "@/modules/purchases/application/use-cases/purchase-settings.use-case";
import type {
  PurchaseApproval,
  PurchaseSettings,
} from "@/modules/purchases/domain/purchase-approval";
import type { PurchaseRequest } from "@/modules/purchases/domain/purchase-request";
import { PurchaseRequestFilterInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-request-filter.input";
import { PurchaseSettingsInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-settings.input";
import {
  PurchaseApprovalOverviewType,
  PurchaseApprovalType,
  PurchaseSettingsType,
} from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-approval.output";
import { PurchaseSummaryFileType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-summary-file.output";
import { PurchaseRequestType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request.output";
import { QuoteBoardPage } from "@/modules/purchases/presentation/graphql/dto/outputs/quote-board.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };
const NOTE_ARG = { type: () => String, nullable: true } as const;

// The approval of the chosen quotes (aprovação por alçada): the settings
// (read by the management and the approvers, changed by the approvers),
// the approvals page, a request's decisions, and the decisions themselves
// (approvers only).
@RequireModule(AppModule.PURCHASES)
@Resolver()
export class PurchaseApprovalsResolver {
  constructor(
    private readonly settings: PurchaseSettingsUseCase,
    private readonly listing: ListPurchaseApprovalsUseCase,
    private readonly deciding: DecidePurchaseApprovalUseCase,
    private readonly summary: PurchaseSummaryPdfUseCase,
  ) {}

  @Query(() => PurchaseSummaryFileType, {
    description:
      "Resumo da compra em PDF (solicitação, cotações, escolha, aprovação e linha do tempo).",
  })
  async purchaseSummaryPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
  ): Promise<PurchaseSummaryFileType> {
    const file = await this.summary.render(actor, requestId);
    return {
      fileName: file.fileName,
      mimeType: "application/pdf",
      base64Content: file.content.toString("base64"),
    };
  }

  @Query(() => PurchaseSettingsType, {
    description: "Como o condomínio aprova as compras (a alçada).",
  })
  purchaseSettings(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PurchaseSettings> {
    return this.settings.get(actor);
  }

  @RequirePermissions(Permission.PURCHASES_APPROVE)
  @Mutation(() => PurchaseSettingsType, {
    description:
      "Muda como as compras são aprovadas (vale para as próximas escolhas).",
  })
  updatePurchaseSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: PurchaseSettingsInput,
  ): Promise<PurchaseSettings> {
    return this.settings.save(
      actor,
      input.approvalMode,
      input.approvalLimitCents,
    );
  }

  @Query(() => [PurchaseApprovalType], {
    description: "As decisões sobre uma compra, a mais recente primeiro.",
  })
  purchaseApprovals(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
  ): Promise<PurchaseApproval[]> {
    return this.listing.history(actor, requestId);
  }

  @RequirePermissions(Permission.PURCHASES_APPROVE)
  @Query(() => QuoteBoardPage, {
    description:
      "Compras aguardando aprovação, aprovadas ou reprovadas, com a cotação escolhida.",
  })
  approvalBoard(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: PurchaseRequestFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<QuoteBoardRow>> {
    return this.listing.list(actor, filter ?? {}, page ?? DEFAULT_PAGE);
  }

  @RequirePermissions(Permission.PURCHASES_APPROVE)
  @Query(() => PurchaseApprovalOverviewType, {
    description: "As aprovações em números (os cards da página).",
  })
  approvalBoardOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ApprovalOverview> {
    return this.listing.overview(actor);
  }

  @RequirePermissions(Permission.PURCHASES_APPROVE)
  @Mutation(() => PurchaseRequestType, {
    description: "Aprova a cotação escolhida (observação opcional).",
  })
  approvePurchase(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("note", NOTE_ARG) note?: string | null,
  ): Promise<PurchaseRequest> {
    return this.deciding.approve(actor, requestId, note ?? null);
  }

  @RequirePermissions(Permission.PURCHASES_APPROVE)
  @Mutation(() => PurchaseRequestType, {
    description:
      "Devolve a compra para cotação, com o motivo (a escolha é desfeita).",
  })
  returnPurchaseToQuotes(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("reason") reason: string,
  ): Promise<PurchaseRequest> {
    return this.deciding.returnToQuotes(actor, requestId, reason);
  }

  @RequirePermissions(Permission.PURCHASES_APPROVE)
  @Mutation(() => PurchaseRequestType, {
    description: "Reprova a compra, com o motivo (a solicitação é encerrada).",
  })
  rejectPurchase(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("reason") reason: string,
  ): Promise<PurchaseRequest> {
    return this.deciding.reject(actor, requestId, reason);
  }
}
