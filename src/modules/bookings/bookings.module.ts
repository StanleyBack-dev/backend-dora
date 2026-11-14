import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessControlModule } from "@/modules/access-control/access-control.module";
import { AuditModule } from "@/modules/audit/audit.module";
import { BookingAccessService } from "@/modules/bookings/application/booking-access.service";
import { BOOKING_REPOSITORY } from "@/modules/bookings/application/ports/booking-repository.port";
import { SPACE_BLOCK_REPOSITORY } from "@/modules/bookings/application/ports/space-block-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import { ApproveBookingUseCase } from "@/modules/bookings/application/use-cases/approve-booking.use-case";
import { CancelBookingUseCase } from "@/modules/bookings/application/use-cases/cancel-booking.use-case";
import { CreateBookingUseCase } from "@/modules/bookings/application/use-cases/create-booking.use-case";
import { CreateSpaceBlockUseCase } from "@/modules/bookings/application/use-cases/create-space-block.use-case";
import { DeleteSpaceBlockUseCase } from "@/modules/bookings/application/use-cases/delete-space-block.use-case";
import { GetSpaceAvailabilityUseCase } from "@/modules/bookings/application/use-cases/get-space-availability.use-case";
import { ListBookingsUseCase } from "@/modules/bookings/application/use-cases/list-bookings.use-case";
import { ListSpaceBlocksUseCase } from "@/modules/bookings/application/use-cases/list-space-blocks.use-case";
import { RejectBookingUseCase } from "@/modules/bookings/application/use-cases/reject-booking.use-case";
import { BookingOrmEntity } from "@/modules/bookings/infrastructure/persistence/typeorm/booking.orm-entity";
import { BookingTypeormRepository } from "@/modules/bookings/infrastructure/persistence/typeorm/booking-typeorm.repository";
import { SpaceBlockOrmEntity } from "@/modules/bookings/infrastructure/persistence/typeorm/space-block.orm-entity";
import { SpaceBlockTypeormRepository } from "@/modules/bookings/infrastructure/persistence/typeorm/space-block-typeorm.repository";
import { BookingsResolver } from "@/modules/bookings/presentation/graphql/bookings.resolver";
import { SpaceAvailabilityResolver } from "@/modules/bookings/presentation/graphql/space-availability.resolver";
import { SpaceBlocksResolver } from "@/modules/bookings/presentation/graphql/space-blocks.resolver";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { SpacesModule } from "@/modules/spaces/spaces.module";

// Bookings of spaces under each space's rules, approvals, cancellations and
// blocks. Spaces come from SpacesModule; people and units from identity;
// notices go through the outbox.
@Module({
  imports: [
    TypeOrmModule.forFeature([BookingOrmEntity, SpaceBlockOrmEntity]),
    AccessControlModule,
    AuditModule,
    IdentityModule,
    OutboxModule,
    SpacesModule,
  ],
  providers: [
    BookingAccessService,
    SpaceForBooking,
    GetSpaceAvailabilityUseCase,
    CreateBookingUseCase,
    CancelBookingUseCase,
    ApproveBookingUseCase,
    RejectBookingUseCase,
    ListBookingsUseCase,
    CreateSpaceBlockUseCase,
    DeleteSpaceBlockUseCase,
    ListSpaceBlocksUseCase,
    BookingsResolver,
    SpaceAvailabilityResolver,
    SpaceBlocksResolver,
    { provide: BOOKING_REPOSITORY, useClass: BookingTypeormRepository },
    { provide: SPACE_BLOCK_REPOSITORY, useClass: SpaceBlockTypeormRepository },
  ],
})
export class BookingsModule {}
