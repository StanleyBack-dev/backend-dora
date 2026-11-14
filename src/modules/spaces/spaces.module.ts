import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { SPACE_REPOSITORY } from "@/modules/spaces/application/ports/space-repository.port";
import { CreateSpaceUseCase } from "@/modules/spaces/application/use-cases/create-space.use-case";
import { DeleteSpaceUseCase } from "@/modules/spaces/application/use-cases/delete-space.use-case";
import { ListSpacesUseCase } from "@/modules/spaces/application/use-cases/list-spaces.use-case";
import { SetSpaceActiveUseCase } from "@/modules/spaces/application/use-cases/set-space-active.use-case";
import { UpdateSpaceUseCase } from "@/modules/spaces/application/use-cases/update-space.use-case";
import { SpaceOrmEntity } from "@/modules/spaces/infrastructure/persistence/typeorm/space.orm-entity";
import { SpaceTypeormRepository } from "@/modules/spaces/infrastructure/persistence/typeorm/space-typeorm.repository";
import { SpacesResolver } from "@/modules/spaces/presentation/graphql/spaces.resolver";

// Bookable spaces of each condominium and their booking rules. The bookings
// module (next stage) will read them through what this module exports.
@Module({
  imports: [
    TypeOrmModule.forFeature([SpaceOrmEntity]),
    AccessControlModule,
    AuditModule,
  ],
  providers: [
    ListSpacesUseCase,
    CreateSpaceUseCase,
    UpdateSpaceUseCase,
    SetSpaceActiveUseCase,
    DeleteSpaceUseCase,
    SpacesResolver,
    { provide: SPACE_REPOSITORY, useClass: SpaceTypeormRepository },
  ],
})
export class SpacesModule {}
