import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { CatalogModule } from "@/modules/catalog/catalog.module";
import { SpacesModule } from "@/modules/spaces/spaces.module";
import { SuppliersModule } from "@/modules/suppliers/suppliers.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { PURCHASE_REQUEST_REPOSITORY } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import { CancelPurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/cancel-purchase-request.use-case";
import { CreatePurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/create-purchase-request.use-case";
import { ListPurchaseRequestsUseCase } from "@/modules/purchases/application/use-cases/list-purchase-requests.use-case";
import { UpdatePurchaseRequestUseCase } from "@/modules/purchases/application/use-cases/update-purchase-request.use-case";
import { PurchaseRequestSqlRepository } from "@/modules/purchases/infrastructure/persistence/purchase-request-sql.repository";
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
  ],
  providers: [
    PurchasesAccessService,
    ListPurchaseRequestsUseCase,
    CreatePurchaseRequestUseCase,
    UpdatePurchaseRequestUseCase,
    CancelPurchaseRequestUseCase,
    PurchaseRequestsResolver,
    {
      provide: PURCHASE_REQUEST_REPOSITORY,
      useClass: PurchaseRequestSqlRepository,
    },
  ],
})
export class PurchasesModule {}
