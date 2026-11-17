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
import { BookingsMaintenanceService } from "@/modules/bookings/application/bookings-maintenance.service";
import { BookingPolicyService } from "@/modules/bookings/application/booking-policy.service";
import { FreedSlotNoticesService } from "@/modules/bookings/application/freed-slot-notices.service";
import { GuestBookingService } from "@/modules/bookings/application/guest-booking.service";
import { BOOKING_GUEST_REPOSITORY } from "@/modules/bookings/application/ports/booking-guest-repository.port";
import { WAITLIST_REPOSITORY } from "@/modules/bookings/application/ports/waitlist-repository.port";
import { AddBookingGuestsUseCase } from "@/modules/bookings/application/use-cases/add-booking-guests.use-case";
import { CancelBookingSeriesUseCase } from "@/modules/bookings/application/use-cases/cancel-booking-series.use-case";
import { CheckInGuestUseCase } from "@/modules/bookings/application/use-cases/check-in-guest.use-case";
import { CreateBookingSeriesUseCase } from "@/modules/bookings/application/use-cases/create-booking-series.use-case";
import { GetGuestInviteUseCase } from "@/modules/bookings/application/use-cases/get-guest-invite.use-case";
import { JoinWaitlistUseCase } from "@/modules/bookings/application/use-cases/join-waitlist.use-case";
import { LeaveWaitlistUseCase } from "@/modules/bookings/application/use-cases/leave-waitlist.use-case";
import { ListBookingFeesUseCase } from "@/modules/bookings/application/use-cases/list-booking-fees.use-case";
import { ListBookingGuestsUseCase } from "@/modules/bookings/application/use-cases/list-booking-guests.use-case";
import { ListGateGuestsUseCase } from "@/modules/bookings/application/use-cases/list-gate-guests.use-case";
import { RemoveBookingGuestUseCase } from "@/modules/bookings/application/use-cases/remove-booking-guest.use-case";
import { SetBookingFeesBilledUseCase } from "@/modules/bookings/application/use-cases/set-booking-fees-billed.use-case";
import { BookingGuestTypeormRepository } from "@/modules/bookings/infrastructure/persistence/typeorm/booking-guest-typeorm.repository";
import { WaitlistTypeormRepository } from "@/modules/bookings/infrastructure/persistence/typeorm/waitlist-typeorm.repository";
import { BookingFeesResolver } from "@/modules/bookings/presentation/graphql/booking-fees.resolver";
import { BookingGuestsResolver } from "@/modules/bookings/presentation/graphql/booking-guests.resolver";
import { BookingSeriesResolver } from "@/modules/bookings/presentation/graphql/booking-series.resolver";
import { BookingWaitlistResolver } from "@/modules/bookings/presentation/graphql/booking-waitlist.resolver";
import { GateResolver } from "@/modules/bookings/presentation/graphql/gate.resolver";
import { GuestInviteResolver } from "@/modules/bookings/presentation/graphql/guest-invite.resolver";
import { IdentityModule } from "@/modules/identity/identity.module";
import { OutboxModule } from "@/modules/outbox/outbox.module";
import { CondominiumsModule } from "@/modules/condominiums/condominiums.module";
import { SpacesModule } from "@/modules/spaces/spaces.module";

// Bookings of spaces under each space's rules, approvals, cancellations and
// blocks; weekly series, the waiting list, guests with the gate's check-in
// and usage fees. Spaces come from SpacesModule; people and units from identity;
// notices go through the outbox.
@Module({
  imports: [
    TypeOrmModule.forFeature([BookingOrmEntity, SpaceBlockOrmEntity]),
    AccessControlModule,
    AuditModule,
    CondominiumsModule,
    IdentityModule,
    OutboxModule,
    SpacesModule,
  ],
  providers: [
    BookingAccessService,
    SpaceForBooking,
    BookingPolicyService,
    BookingsMaintenanceService,
    FreedSlotNoticesService,
    GuestBookingService,
    CreateBookingSeriesUseCase,
    CancelBookingSeriesUseCase,
    JoinWaitlistUseCase,
    LeaveWaitlistUseCase,
    ListBookingGuestsUseCase,
    AddBookingGuestsUseCase,
    RemoveBookingGuestUseCase,
    GetGuestInviteUseCase,
    ListGateGuestsUseCase,
    CheckInGuestUseCase,
    ListBookingFeesUseCase,
    SetBookingFeesBilledUseCase,
    BookingGuestsResolver,
    GuestInviteResolver,
    GateResolver,
    BookingWaitlistResolver,
    BookingSeriesResolver,
    BookingFeesResolver,
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
    { provide: WAITLIST_REPOSITORY, useClass: WaitlistTypeormRepository },
    {
      provide: BOOKING_GUEST_REPOSITORY,
      useClass: BookingGuestTypeormRepository,
    },
  ],
  exports: [BookingsMaintenanceService],
})
export class BookingsModule {}
