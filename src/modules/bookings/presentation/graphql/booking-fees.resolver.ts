import { Args, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { ListBookingFeesUseCase } from "@/modules/bookings/application/use-cases/list-booking-fees.use-case";
import { SetBookingFeesBilledUseCase } from "@/modules/bookings/application/use-cases/set-booking-fees-billed.use-case";
import { toBookingType } from "@/modules/bookings/presentation/graphql/booking.mapper";
import { SetBookingFeesBilledInput } from "@/modules/bookings/presentation/graphql/dto/inputs/set-booking-fees-billed.input";
import { BookingFeesType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking-fees.output";

// Usage fees for the condominium's billing (managers).
@Resolver()
export class BookingFeesResolver {
  constructor(
    private readonly listing: ListBookingFeesUseCase,
    private readonly billing: SetBookingFeesBilledUseCase,
  ) {}

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Query(() => BookingFeesType, {
    description: "Taxas de uso de um mês (padrão: o atual), por unidade.",
  })
  async bookingFees(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("month", {
      type: () => String,
      nullable: true,
      description: "YYYY-MM.",
    })
    month: string | null,
  ): Promise<BookingFeesType> {
    const fees = await this.listing.execute(actor, month?.slice(0, 7));
    return { ...fees, items: fees.items.map(toBookingType) };
  }

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Mutation(() => Int, {
    description:
      "Marca (ou desmarca) taxas como lançadas na cobrança; devolve quantas mudaram.",
  })
  setBookingFeesBilled(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: SetBookingFeesBilledInput,
  ): Promise<number> {
    return this.billing.execute(actor, input.bookingIds, input.billed);
  }
}
