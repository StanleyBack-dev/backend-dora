import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import {
  type PurchaseIndicators,
  PurchaseIndicatorsUseCase,
} from "@/modules/purchases/application/use-cases/purchase-indicators.use-case";
import {
  type PurchaseReportFile,
  PurchaseReportPdfUseCase,
} from "@/modules/purchases/application/use-cases/purchase-report-pdf.use-case";
import {
  PurchaseTransparencyUseCase,
  type TransparencyStatus,
  type TransparencySummary,
} from "@/modules/purchases/application/use-cases/purchase-transparency.use-case";
import type {
  IndicatorPeriod,
  TransparencyPurchase,
} from "@/modules/purchases/domain/purchase-indicators";
import { IndicatorPeriodInput } from "@/modules/purchases/presentation/graphql/dto/inputs/indicator-period.input";
import {
  PurchaseIndicatorsType,
  PurchaseReportFileType,
  TransparencyPurchasePage,
  TransparencyStatusType,
  TransparencySummaryType,
} from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-indicators.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

const periodOf = (input: IndicatorPeriodInput): IndicatorPeriod => ({
  year: input.year,
  month: input.month ?? null,
});

const pdf = (file: PurchaseReportFile) => ({
  fileName: file.fileName,
  mimeType: "application/pdf",
  base64Content: file.content.toString("base64"),
});

/**
 * The purchases in figures: the management's indicators and the residents'
 * accounts (prestação de contas, published by the approvers), each also as
 * a PDF. The use cases check who may read each.
 */
@RequireModule(AppModule.PURCHASES)
@Resolver()
export class PurchaseIndicatorsResolver {
  constructor(
    private readonly indicators: PurchaseIndicatorsUseCase,
    private readonly transparency: PurchaseTransparencyUseCase,
    private readonly reports: PurchaseReportPdfUseCase,
  ) {}

  @Query(() => PurchaseIndicatorsType, {
    description:
      "Gasto por categoria, mês e fornecedor, o comprometido e o processo (gestão e aprovadores).",
  })
  purchaseIndicators(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("period") period: IndicatorPeriodInput,
  ): Promise<PurchaseIndicators> {
    return this.indicators.indicators(actor, periodOf(period));
  }

  @Query(() => PurchaseReportFileType, {
    description: "Os indicadores do período em PDF (A4 deitado).",
  })
  async purchaseIndicatorsPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("period") period: IndicatorPeriodInput,
  ) {
    return pdf(await this.reports.indicators(actor, periodOf(period)));
  }

  @Query(() => TransparencyStatusType, {
    description: "Se a prestação de contas está publicada (qualquer membro).",
  })
  purchaseTransparencyStatus(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<TransparencyStatus> {
    return this.transparency.status(actor);
  }

  @Query(() => TransparencySummaryType, {
    description: "Gasto por categoria e mês na prestação de contas.",
  })
  purchaseTransparency(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("period") period: IndicatorPeriodInput,
  ): Promise<TransparencySummary> {
    return this.transparency.summary(actor, periodOf(period));
  }

  @Query(() => TransparencyPurchasePage, {
    description: "As compras concluídas no período, da mais recente.",
  })
  transparencyPurchases(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("period") period: IndicatorPeriodInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<TransparencyPurchase>> {
    return this.transparency.purchases(
      actor,
      periodOf(period),
      page ?? DEFAULT_PAGE,
    );
  }

  @Query(() => PurchaseReportFileType, {
    description: "A prestação de contas do período em PDF (A4 deitado).",
  })
  async purchaseTransparencyPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("period") period: IndicatorPeriodInput,
  ) {
    return pdf(await this.reports.transparency(actor, periodOf(period)));
  }

  @RequirePermissions(Permission.PURCHASES_APPROVE)
  @Mutation(() => TransparencyStatusType, {
    description: "Publica ou retira a prestação de contas (aprovadores).",
  })
  publishPurchaseTransparency(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("enabled") enabled: boolean,
  ): Promise<TransparencyStatus> {
    return this.transparency.publish(actor, enabled);
  }
}
