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
import { EventOrderAccessService } from "@/modules/events/application/event-order-access.service";
import { EventPaymentService } from "@/modules/events/application/event-payment.service";
import { EventsMaintenanceService } from "@/modules/events/application/events-maintenance.service";
import { EVENT_ORDER_REPOSITORY } from "@/modules/events/application/ports/event-order-repository.port";
import { CancelEventOrderUseCase } from "@/modules/events/application/use-cases/cancel-event-order.use-case";
import { CreateEventOrderUseCase } from "@/modules/events/application/use-cases/create-event-order.use-case";
import { ListEventOrdersUseCase } from "@/modules/events/application/use-cases/list-event-orders.use-case";
import { ListMyEventOrdersUseCase } from "@/modules/events/application/use-cases/list-my-event-orders.use-case";
import { ReviewEventOrderUseCase } from "@/modules/events/application/use-cases/review-event-order.use-case";
import { SubmitOrderReceiptUseCase } from "@/modules/events/application/use-cases/submit-order-receipt.use-case";
import { EventOrderSqlRepository } from "@/modules/events/infrastructure/persistence/event-order-sql.repository";
import { EventOrderFieldsResolver } from "@/modules/events/presentation/graphql/event-order-fields.resolver";
import { EventOrdersResolver } from "@/modules/events/presentation/graphql/event-orders.resolver";
import { EventPaymentsResolver } from "@/modules/events/presentation/graphql/event-payments.resolver";
import { EventOrderReviewQueue } from "@/modules/events/application/event-order-review-queue.service";
import { SubmitAttendeeProofUseCase } from "@/modules/events/application/use-cases/submit-attendee-proof.use-case";
import { AttendeeFieldsResolver } from "@/modules/events/presentation/graphql/attendee-fields.resolver";
import { DependentsModule } from "@/modules/dependents/dependents.module";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { SpacesModule } from "@/modules/spaces/spaces.module";

// Condominium events, a module contracted apart (AppModule.EVENTS): reads
// spaces (where), members (who is told), the module switch and the
// condominium's PIX; writes its notices to the outbox. Members order
// tickets and send the PIX receipt; whoever manages payments reviews it.
@Module({
  imports: [
    AccessControlModule,
    AuditModule,
    CondominiumsModule,
    DependentsModule,
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
    EventPaymentService,
    EventOrderAccessService,
    CreateEventOrderUseCase,
    ListMyEventOrdersUseCase,
    ListEventOrdersUseCase,
    SubmitOrderReceiptUseCase,
    CancelEventOrderUseCase,
    ReviewEventOrderUseCase,
    EventsMaintenanceService,
    EventOrdersResolver,
    EventPaymentsResolver,
    EventOrderFieldsResolver,
    EventOrderReviewQueue,
    SubmitAttendeeProofUseCase,
    AttendeeFieldsResolver,
    { provide: EVENT_REPOSITORY, useClass: EventSqlRepository },
    { provide: EVENT_ORDER_REPOSITORY, useClass: EventOrderSqlRepository },
  ],
  exports: [EventsMaintenanceService],
})
export class EventsModule {}
