import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { UnitRegistryService } from "@/modules/condominiums/application/unit-registry.service";
import { CondominiumsUseCase } from "@/modules/condominiums/application/use-cases/condominiums.use-case";
import { UnitsUseCase } from "@/modules/condominiums/application/use-cases/units.use-case";
import { CONDOMINIUM_REPOSITORY } from "@/modules/condominiums/application/ports/condominium-repository.port";
import { UNIT_REPOSITORY } from "@/modules/condominiums/application/ports/unit-repository.port";
import { CondominiumOrmEntity } from "@/modules/condominiums/infrastructure/persistence/typeorm/condominium.orm-entity";
import { UnitOrmEntity } from "@/modules/condominiums/infrastructure/persistence/typeorm/unit.orm-entity";
import { CondominiumTypeormRepository } from "@/modules/condominiums/infrastructure/persistence/typeorm/condominium-typeorm.repository";
import { UnitTypeormRepository } from "@/modules/condominiums/infrastructure/persistence/typeorm/unit-typeorm.repository";
import { CondominiumsResolver } from "@/modules/condominiums/presentation/graphql/condominiums.resolver";
import { UnitsResolver } from "@/modules/condominiums/presentation/graphql/units.resolver";
import { CondominiumModulesResolver } from "@/modules/condominiums/presentation/graphql/condominium-modules.resolver";
import { SetCondominiumModuleUseCase } from "@/modules/condominiums/application/use-cases/set-condominium-module.use-case";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { ModuleGuard } from "@/modules/condominiums/presentation/guards/module.guard";
import { CONDOMINIUM_MODULE_REPOSITORY } from "@/modules/condominiums/application/ports/condominium-module-repository.port";
import { CondominiumModuleTypeormRepository } from "@/modules/condominiums/infrastructure/persistence/typeorm/condominium-module-typeorm.repository";
import { CondominiumPixLookupService } from "@/modules/condominiums/application/condominium-pix-lookup.service";
import { CONDOMINIUM_PIX_REPOSITORY } from "@/modules/condominiums/application/ports/condominium-pix-repository.port";
import { CondominiumPixUseCase } from "@/modules/condominiums/application/use-cases/condominium-pix.use-case";
import { CondominiumPixSqlRepository } from "@/modules/condominiums/infrastructure/persistence/condominium-pix-sql.repository";
import { CondominiumPixResolver } from "@/modules/condominiums/presentation/graphql/condominium-pix.resolver";

// The tenants (condominiums, managed by the platform) and their units
// (managed by each condominium's managers). Who belongs to a condominium is
// identity's business (memberships); this module depends on no other
// feature module, so identity and enrollment can use its lookup service.
@Module({
  imports: [
    TypeOrmModule.forFeature([CondominiumOrmEntity, UnitOrmEntity]),
    AuditModule,
  ],
  providers: [
    CondominiumsUseCase,
    UnitsUseCase,
    CondominiumLookupService,
    UnitRegistryService,
    CondominiumsResolver,
    UnitsResolver,
    CondominiumModulesResolver,
    SetCondominiumModuleUseCase,
    ModuleAccessService,
    ModuleGuard,
    CondominiumPixUseCase,
    CondominiumPixLookupService,
    CondominiumPixResolver,
    {
      provide: CONDOMINIUM_PIX_REPOSITORY,
      useClass: CondominiumPixSqlRepository,
    },
    {
      provide: CONDOMINIUM_MODULE_REPOSITORY,
      useClass: CondominiumModuleTypeormRepository,
    },
    { provide: CONDOMINIUM_REPOSITORY, useClass: CondominiumTypeormRepository },
    { provide: UNIT_REPOSITORY, useClass: UnitTypeormRepository },
  ],
  exports: [
    CondominiumLookupService,
    UnitRegistryService,
    ModuleAccessService,
    ModuleGuard,
    CondominiumPixLookupService,
  ],
})
export class CondominiumsModule {}
