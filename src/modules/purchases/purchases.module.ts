import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { SUPPLIER_REPOSITORY } from "@/modules/purchases/application/ports/supplier-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import { CreateSupplierUseCase } from "@/modules/purchases/application/use-cases/create-supplier.use-case";
import { ListSuppliersUseCase } from "@/modules/purchases/application/use-cases/list-suppliers.use-case";
import { SetSupplierActiveUseCase } from "@/modules/purchases/application/use-cases/set-supplier-active.use-case";
import { UpdateSupplierUseCase } from "@/modules/purchases/application/use-cases/update-supplier.use-case";
import { SupplierSqlRepository } from "@/modules/purchases/infrastructure/persistence/supplier-sql.repository";
import { SuppliersResolver } from "@/modules/purchases/presentation/graphql/suppliers.resolver";

// Purchases (compras do condomínio), a module contracted apart: suppliers,
// purchase requests, quotes and their approval. Purchases between
// residents will be a module of their own (marketplace).
@Module({
  imports: [AccessControlModule, AuditModule, CondominiumsModule],
  providers: [
    PurchasesAccessService,
    ListSuppliersUseCase,
    CreateSupplierUseCase,
    UpdateSupplierUseCase,
    SetSupplierActiveUseCase,
    SuppliersResolver,
    { provide: SUPPLIER_REPOSITORY, useClass: SupplierSqlRepository },
  ],
})
export class PurchasesModule {}
