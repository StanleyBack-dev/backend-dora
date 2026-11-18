import { Args, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import type { FeeFilter } from "@/modules/bookings/application/ports/booking-repository.port";
import { GetBookingFeesOverviewUseCase } from "@/modules/bookings/application/use-cases/get-booking-fees-overview.use-case";
import { ListBookingFeesPageUseCase } from "@/modules/bookings/application/use-cases/list-booking-fees-page.use-case";
import { ListBookingFeesUseCase } from "@/modules/bookings/application/use-cases/list-booking-fees.use-case";
import { SetBookingFeesBilledUseCase } from "@/modules/bookings/application/use-cases/set-booking-fees-billed.use-case";
import { toBookingType } from "@/modules/bookings/presentation/graphql/booking.mapper";
import { FeeFilterInput } from "@/modules/bookings/presentation/graphql/dto/inputs/fee-filter.input";
import { SetBookingFeesBilledInput } from "@/modules/bookings/presentation/graphql/dto/inputs/set-booking-fees-billed.input";
import { BookingFeesOverviewType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking-fees-overview.output";
import { BookingFeesType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking-fees.output";
import { BookingPage } from "@/modules/bookings/presentation/graphql/dto/outputs/booking-page.output";
import type { BookingType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking.output";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

const monthArg = {
  type: () => String,
  nullable: true,
  description: "YYYY-MM (padrão: o mês atual).",
};
const filterArg = {
  type: () => FeeFilterInput,
  nullable: true,
};

const toFeeFilter = (input?: FeeFilterInput | null): FeeFilter => ({
  unitId: input?.unitId ?? null,
  spaceId: input?.spaceId ?? null,
  userId: input?.userId ?? null,
  billed: input?.billed ?? null,
});

// Usage fees for the condominium's billing (managers): the month's numbers
// and filter options, a page filtered by the API, every fee of the filter
// (the spreadsheet), and marking them as sent to billing.
@RequireModule(AppModule.BOOKINGS)
@Resolver()
export class BookingFeesResolver {
  constructor(
    private readonly listing: ListBookingFeesUseCase,
    private readonly paging: ListBookingFeesPageUseCase,
    private readonly overview: GetBookingFeesOverviewUseCase,
    private readonly billing: SetBookingFeesBilledUseCase,
  ) {}

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Query(() => BookingFeesType, {
    description:
      "Todas as taxas de uso de um mês que atendem aos filtros, por unidade (a planilha).",
  })
  async bookingFees(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("month", monthArg) month: string | null,
    @Args("filter", filterArg) filter?: FeeFilterInput | null,
  ): Promise<BookingFeesType> {
    const fees = await this.listing.execute(
      actor,
      month?.slice(0, 7),
      toFeeFilter(filter),
    );
    return { ...fees, items: fees.items.map(toBookingType) };
  }

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Query(() => BookingPage, {
    description:
      "As taxas de uso de um mês, com filtros, por página (por unidade).",
  })
  async bookingFeesPage(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("month", monthArg) month: string | null,
    @Args("filter", filterArg) filter?: FeeFilterInput | null,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<BookingType>> {
    const result = await this.paging.execute(
      actor,
      month?.slice(0, 7) ?? null,
      toFeeFilter(filter),
      page ?? DEFAULT_PAGE,
    );
    return { ...result, items: result.items.map(toBookingType) };
  }

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Query(() => BookingFeesOverviewType, {
    description:
      "Os números das taxas de uso de um mês e as opções dos filtros.",
  })
  bookingFeesOverview(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("month", monthArg) month: string | null,
  ): Promise<BookingFeesOverviewType> {
    return this.overview.execute(actor, month?.slice(0, 7) ?? null);
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
