import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { CatalogModule } from "@/modules/catalog/catalog.module";
import { SpacesModule } from "@/modules/spaces/spaces.module";
import { SuppliersModule } from "@/modules/suppliers/suppliers.module";
import { MailModule } from "@/modules/mails/mail.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { PURCHASE_QUOTE_REPOSITORY } from "@/modules/purchases/application/ports/purchase-quote-repository.port";
import { QUOTE_MAP_RENDERER } from "@/modules/purchases/application/ports/quote-map-renderer.port";
import { PURCHASE_REQUEST_REPOSITORY } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import { ChoosePurchaseQuoteUseCase } from "@/modules/purchases/application/use-cases/choose-purchase-quote.use-case";
import { ListPurchaseQuotesUseCase } from "@/modules/purchases/application/use-cases/list-purchase-quotes.use-case";
import { ListQuoteBoardUseCase } from "@/modules/purchases/application/use-cases/list-quote-board.use-case";
import { SavePurchaseQuoteUseCase } from "@/modules/purchases/application/use-cases/save-purchase-quote.use-case";
import { CancelPurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/cancel-purchase-request.use-case";
import { CreatePurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/create-purchase-request.use-case";
import { ListPurchaseRequestsUseCase } from "@/modules/purchases/application/use-cases/list-purchase-requests.use-case";
import { UpdatePurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/update-purchase-request.use-case";
import { ShareQuoteMapUseCase } from "@/modules/purchases/application/use-cases/share-quote-map.use-case";
import { PURCHASE_APPROVAL_REPOSITORY } from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import { DecidePurchaseApprovalUseCase } from "@/modules/purchases/application/use-cases/decide-purchase-approval.use-case";
import { ListPurchaseApprovalsUseCase } from "@/modules/purchases/application/use-cases/list-purchase-approvals.use-case";
import { PurchaseSettingsUseCase } from "@/modules/purchases/application/use-cases/purchase-settings.use-case";
import { PurchaseApprovalSqlRepository } from "@/modules/purchases/infrastructure/persistence/purchase-approval-sql.repository";
import { PurchaseApprovalsResolver } from "@/modules/purchases/presentation/graphql/purchase-approvals.resolver";
import { PURCHASE_SUMMARY_RENDERER } from "@/modules/purchases/application/ports/purchase-summary-renderer.port";
import { PurchaseSummaryPdfUseCase } from "@/modules/purchases/application/use-cases/purchase-summary-pdf.use-case";
import { PdfLibPurchaseSummaryRenderer } from "@/modules/purchases/infrastructure/pdf/pdf-lib-purchase-summary.renderer";
import { PdfLibQuoteMapRenderer } from "@/modules/purchases/infrastructure/pdf/pdf-lib-quote-map.renderer";
import { PurchaseQuoteSqlRepository } from "@/modules/purchases/infrastructure/persistence/purchase-quote-sql.repository";
import { PurchaseRequestSqlRepository } from "@/modules/purchases/infrastructure/persistence/purchase-request-sql.repository";
import { PurchaseQuotesResolver } from "@/modules/purchases/presentation/graphql/purchase-quotes.resolver";
import { QuoteBoardResolver } from "@/modules/purchases/presentation/graphql/quote-board.resolver";
import { PurchaseRequestsResolver } from "@/modules/purchases/presentation/graphql/purchase-requests.resolver";

// Purchases (compras do condomínio), a module contracted apart: purchase
// requests, quotes and their approval, on the shared catalog (products,
// brands, categories) and suppliers registry. Purchases between
// residents will be a module of their own (marketplace).
@Module({
  imports: [
    AccessControlModule,
    AuditModule,
    CatalogModule,
    SpacesModule,
    SuppliersModule,
    CondominiumsModule,
    IdentityModule,
    OutboxModule,
    MailModule,
  ],
  providers: [
    PurchasesAccessService,
    ShareQuoteMapUseCase,
    ListPurchaseRequestsUseCase,
    CreatePurchaseRequestUseCase,
    UpdatePurchaseRequestUseCase,
    CancelPurchaseRequestUseCase,
    PurchaseRequestsResolver,
    ListPurchaseQuotesUseCase,
    ListQuoteBoardUseCase,
    SavePurchaseQuoteUseCase,
    ChoosePurchaseQuoteUseCase,
    PurchaseQuotesResolver,
    QuoteBoardResolver,
    PurchaseSettingsUseCase,
    ListPurchaseApprovalsUseCase,
    DecidePurchaseApprovalUseCase,
    PurchaseApprovalsResolver,
    PurchaseSummaryPdfUseCase,
    {
      provide: PURCHASE_SUMMARY_RENDERER,
      useClass: PdfLibPurchaseSummaryRenderer,
    },
    {
      provide: PURCHASE_APPROVAL_REPOSITORY,
      useClass: PurchaseApprovalSqlRepository,
    },
    {
      provide: PURCHASE_QUOTE_REPOSITORY,
      useClass: PurchaseQuoteSqlRepository,
    },
    { provide: QUOTE_MAP_RENDERER, useClass: PdfLibQuoteMapRenderer },
    {
      provide: PURCHASE_REQUEST_REPOSITORY,
      useClass: PurchaseRequestSqlRepository,
    },
  ],
})
export class PurchasesModule {}
