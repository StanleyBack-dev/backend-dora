import { Module } from "@nestjs/common";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import { EventInputService } from "@/modules/events/application/event-input.service";
import { EVENT_REPOSITORY } from "@/modules/events/application/ports/event-repository.port";
import { CancelEventUseCase } from "@/modules/events/application/use-cases/cancel-event.use-case";
import { CreateEventUseCase } from "@/modules/events/application/use-cases/create-event.use-case";
import { GetEventUseCase } from "@/modules/events/application/use-cases/get-event.use-case";
import { ListEventsUseCase } from "@/modules/events/application/use-cases/list-events.use-case";
import { PublishEventUseCase } from "@/modules/events/application/use-cases/publish-event.use-case";
import { UpdateEventUseCase } from "@/modules/events/application/use-cases/update-event.use-case";
import { EventSqlRepository } from "@/modules/events/infrastructure/persistence/event-sql.repository";
import { EventManagementResolver } from "@/modules/events/presentation/graphql/event-management.resolver";
import { EventsResolver } from "@/modules/events/presentation/graphql/events.resolver";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { SpacesModule } from "@/modules/spaces/spaces.module";

// Condominium events, a module contracted apart (AppModule.EVENTS): reads
// spaces (where), members (who is told) and the module switch, and writes
// its notices to the outbox.
@Module({
  imports: [
    AccessControlModule,
    AuditModule,
    CondominiumsModule,
    IdentityModule,
    OutboxModule,
    SpacesModule,
  ],
  providers: [
    EventAccessService,
    EventInputService,
    ListEventsUseCase,
    GetEventUseCase,
    CreateEventUseCase,
    UpdateEventUseCase,
    PublishEventUseCase,
    CancelEventUseCase,
    EventsResolver,
    EventManagementResolver,
    { provide: EVENT_REPOSITORY, useClass: EventSqlRepository },
  ],
})
export class EventsModule {}
