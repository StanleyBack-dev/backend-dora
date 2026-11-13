import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { BroadcastsUseCase } from "@/modules/broadcasts/application/use-cases/broadcasts.use-case";
import { BROADCAST_REPOSITORY } from "@/modules/broadcasts/application/ports/broadcast-repository.port";
import { BroadcastOrmEntity } from "@/modules/broadcasts/infrastructure/persistence/typeorm/broadcast.orm-entity";
import { BroadcastTypeormRepository } from "@/modules/broadcasts/infrastructure/persistence/typeorm/broadcast-typeorm.repository";
import { BroadcastsResolver } from "@/modules/broadcasts/presentation/graphql/broadcasts.resolver";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";

// Announcements (comunicados): picks the audience through identity and
// notifies through the outbox like every other notice.
@Module({
  imports: [
    TypeOrmModule.forFeature([BroadcastOrmEntity]),
    AuditModule,
    IdentityModule,
    OutboxModule,
  ],
  providers: [
    BroadcastsUseCase,
    BroadcastsResolver,
    { provide: BROADCAST_REPOSITORY, useClass: BroadcastTypeormRepository },
  ],
})
export class BroadcastsModule {}
