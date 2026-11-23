import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { SUPPLIER_REPOSITORY } from "@/modules/suppliers/application/ports/supplier-repository.port";
import { SuppliersAccessService } from "@/modules/suppliers/application/suppliers-access.service";
import { CreateSupplierUseCase } from "@/modules/suppliers/application/use-cases/create-supplier.use-case";
import { ListSuppliersUseCase } from "@/modules/suppliers/application/use-cases/list-suppliers.use-case";
import { SetSupplierActiveUseCase } from "@/modules/suppliers/application/use-cases/set-supplier-active.use-case";
import { UpdateSupplierUseCase } from "@/modules/suppliers/application/use-cases/update-supplier.use-case";
import { SupplierSqlRepository } from "@/modules/suppliers/infrastructure/persistence/supplier-sql.repository";
import { SuppliersResolver } from "@/modules/suppliers/presentation/graphql/suppliers.resolver";

/**
 * The condominium's suppliers (who it buys from or hires), shared by the
 * modules that work with them: purchases now (quotes), maintenance or
 * events later. It is no paid module of its own; it opens to the modules
 * listed in SuppliersAccessService. The repository is exported so those
 * modules check (and read) the suppliers their records point to.
 */
@Module({
  imports: [AccessControlModule, AuditModule, CondominiumsModule],
  providers: [
    SuppliersAccessService,
    ListSuppliersUseCase,
    CreateSupplierUseCase,
    UpdateSupplierUseCase,
    SetSupplierActiveUseCase,
    SuppliersResolver,
    { provide: SUPPLIER_REPOSITORY, useClass: SupplierSqlRepository },
  ],
  exports: [SUPPLIER_REPOSITORY],
})
export class SuppliersModule {}
