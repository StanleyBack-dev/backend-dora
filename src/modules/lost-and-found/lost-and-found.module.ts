import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { LostFoundDeclarationService } from "@/modules/lost-and-found/application/lost-found-declaration.service";
import { LostFoundMaintenanceService } from "@/modules/lost-and-found/application/lost-found-maintenance.service";
import { FOUND_ITEM_REPOSITORY } from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import { ClaimFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/claim-found-item.use-case";
import { CloseFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/close-found-item.use-case";
import { DecideClaimUseCase } from "@/modules/lost-and-found/application/use-cases/decide-claim.use-case";
import { GetReturnReceiptPdfUseCase } from "@/modules/lost-and-found/application/use-cases/get-return-receipt-pdf.use-case";
import { RETURN_RECEIPT_RENDERER } from "@/modules/lost-and-found/application/ports/return-receipt-renderer.port";
import { PdfLibReturnReceiptRenderer } from "@/modules/lost-and-found/infrastructure/pdf/pdf-lib-return-receipt.renderer";
import { GetReturnReceiptUseCase } from "@/modules/lost-and-found/application/use-cases/get-return-receipt.use-case";
import { ListFoundItemStaffUseCase } from "@/modules/lost-and-found/application/use-cases/list-found-item-staff.use-case";
import { ListFoundItemsUseCase } from "@/modules/lost-and-found/application/use-cases/list-found-items.use-case";
import { RegisterFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/register-found-item.use-case";
import { ReleaseFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/release-found-item.use-case";
import { SearchFoundItemOwnersUseCase } from "@/modules/lost-and-found/application/use-cases/search-found-item-owners.use-case";
import { ReturnFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/return-found-item.use-case";
import { FoundItemSqlRepository } from "@/modules/lost-and-found/infrastructure/persistence/found-item-sql.repository";
import { FoundItemClaimFieldsResolver } from "@/modules/lost-and-found/presentation/graphql/found-item-claim-fields.resolver";
import { FoundItemFieldsResolver } from "@/modules/lost-and-found/presentation/graphql/found-item-fields.resolver";
import { LOST_REPORT_REPOSITORY } from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import { ListLostReportsUseCase } from "@/modules/lost-and-found/application/use-cases/list-lost-reports.use-case";
import { SpotLostReportUseCase } from "@/modules/lost-and-found/application/use-cases/spot-lost-report.use-case";
import { ReportLostItemUseCase } from "@/modules/lost-and-found/application/use-cases/report-lost-item.use-case";
import { LostReportSqlRepository } from "@/modules/lost-and-found/infrastructure/persistence/lost-report-sql.repository";
import { LostReportFieldsResolver } from "@/modules/lost-and-found/presentation/graphql/lost-report-fields.resolver";
import { LostReportsResolver } from "@/modules/lost-and-found/presentation/graphql/lost-reports.resolver";
import { LostFoundResolver } from "@/modules/lost-and-found/presentation/graphql/lost-found.resolver";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// Lost and found (achados e perdidos), a module contracted apart: items
// found in the condominium, residents' claims, returns signed on the
// screen, the keeping period and "Perdi algo" (what residents lost).
@Module({
  imports: [
    AccessControlModule,
    CondominiumsModule,
    IdentityModule,
    OutboxModule,
  ],
  providers: [
    LostFoundAccessService,
    LostFoundDeclarationService,
    RegisterFoundItemUseCase,
    ListFoundItemsUseCase,
    ClaimFoundItemUseCase,
    DecideClaimUseCase,
    ReturnFoundItemUseCase,
    CloseFoundItemUseCase,
    GetReturnReceiptUseCase,
    GetReturnReceiptPdfUseCase,
    ReleaseFoundItemUseCase,
    SearchFoundItemOwnersUseCase,
    ListFoundItemStaffUseCase,
    LostFoundMaintenanceService,
    ReportLostItemUseCase,
    ListLostReportsUseCase,
    SpotLostReportUseCase,
    LostFoundResolver,
    LostReportsResolver,
    LostReportFieldsResolver,
    FoundItemFieldsResolver,
    FoundItemClaimFieldsResolver,
    { provide: FOUND_ITEM_REPOSITORY, useClass: FoundItemSqlRepository },
    { provide: LOST_REPORT_REPOSITORY, useClass: LostReportSqlRepository },
    { provide: RETURN_RECEIPT_RENDERER, useClass: PdfLibReturnReceiptRenderer },
  ],
  exports: [LostFoundMaintenanceService],
})
export class LostAndFoundModule {}
