import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { ApproveBookingUseCase } from "@/modules/bookings/application/use-cases/approve-booking.use-case";
import { CancelBookingUseCase } from "@/modules/bookings/application/use-cases/cancel-booking.use-case";
import { CreateBookingUseCase } from "@/modules/bookings/application/use-cases/create-booking.use-case";
import { ListBookingsUseCase } from "@/modules/bookings/application/use-cases/list-bookings.use-case";
import { RejectBookingUseCase } from "@/modules/bookings/application/use-cases/reject-booking.use-case";
import { BookingWhen } from "@/modules/bookings/domain/booking";
import { toBookingType } from "@/modules/bookings/presentation/graphql/booking.mapper";
import { BookingFilterInput } from "@/modules/bookings/presentation/graphql/dto/inputs/booking-filter.input";
import { CreateBookingInput } from "@/modules/bookings/presentation/graphql/dto/inputs/create-booking.input";
import { BookingPage } from "@/modules/bookings/presentation/graphql/dto/outputs/booking-page.output";
import { BookingType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking.output";
import type { Paginated } from "@/shared/application/pagination";
import "@/modules/bookings/presentation/graphql/bookings.graphql-enums";

const DEFAULT_PAGE = { page: 1, limit: 20 };

// Bookings of the session's condominium: residents book and cancel their
// own; managers see every booking, approve, reject and cancel.
@Resolver()
export class BookingsResolver {
  constructor(
    private readonly listing: ListBookingsUseCase,
    private readonly creating: CreateBookingUseCase,
    private readonly cancelling: CancelBookingUseCase,
    private readonly approving: ApproveBookingUseCase,
    private readonly rejecting: RejectBookingUseCase,
  ) {}

  @Query(() => BookingPage, { description: "Minhas reservas." })
  async myBookings(
    @CurrentUser() user: AuthenticatedUser,
    @Args("when", {
      type: () => BookingWhen,
      defaultValue: BookingWhen.UPCOMING,
    })
    when: BookingWhen,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<BookingType>> {
    const found = await this.listing.mine(user, when, page ?? DEFAULT_PAGE);
    return { ...found, items: found.items.map(toBookingType) };
  }

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Query(() => BookingPage, { description: "Todas as reservas do condomínio." })
  async bookings(
    @CurrentUser() user: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: BookingFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<BookingType>> {
    const found = await this.listing.all(
      user,
      filter ?? {},
      page ?? DEFAULT_PAGE,
    );
    return { ...found, items: found.items.map(toBookingType) };
  }

  @RequirePermissions(Permission.BOOKINGS_CREATE)
  @Mutation(() => BookingType, {
    description:
      "Reserva um horário. Confirmada na hora, ou aguardando aprovação quando o espaço exige.",
  })
  async createBooking(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateBookingInput,
  ): Promise<BookingType> {
    return toBookingType(await this.creating.execute(actor, input));
  }

  @Mutation(() => BookingType, {
    description:
      "Cancela a reserva: a sua até o prazo, ou qualquer uma (gestores).",
  })
  async cancelBooking(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason", { type: () => String, nullable: true })
    reason?: string | null,
  ): Promise<BookingType> {
    return toBookingType(
      await this.cancelling.execute(actor, id, reason?.slice(0, 600)),
    );
  }

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Mutation(() => BookingType)
  async approveBooking(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<BookingType> {
    return toBookingType(await this.approving.execute(actor, id));
  }

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Mutation(() => BookingType)
  async rejectBooking(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<BookingType> {
    return toBookingType(
      await this.rejecting.execute(actor, id, reason.slice(0, 600)),
    );
  }
}
