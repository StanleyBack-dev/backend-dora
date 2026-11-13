import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
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
    CondominiumsResolver,
    UnitsResolver,
    { provide: CONDOMINIUM_REPOSITORY, useClass: CondominiumTypeormRepository },
    { provide: UNIT_REPOSITORY, useClass: UnitTypeormRepository },
  ],
  exports: [CondominiumLookupService],
})
export class CondominiumsModule {}
