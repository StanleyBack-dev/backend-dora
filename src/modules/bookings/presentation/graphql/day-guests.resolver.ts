import { Args, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { GetDayGuestsOverviewUseCase } from "@/modules/bookings/application/use-cases/get-day-guests-overview.use-case";
import { ListDayGuestsUseCase } from "@/modules/bookings/application/use-cases/list-day-guests.use-case";
import { DayGuestFilterInput } from "@/modules/bookings/presentation/graphql/dto/inputs/day-guest-filter.input";
import { DayGuestsOverviewType } from "@/modules/bookings/presentation/graphql/dto/outputs/day-guests-overview.output";
import { GateGuestPage } from "@/modules/bookings/presentation/graphql/dto/outputs/gate-guest-page.output";
import type { GateGuestType } from "@/modules/bookings/presentation/graphql/dto/outputs/gate-guest.output";
import { toGateGuestType } from "@/modules/bookings/presentation/graphql/guest.mapper";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

const dateArg = {
  type: () => String,
  nullable: true,
  description: "YYYY-MM-DD (padrão: hoje).",
};

// A day's guests for the managers (Gestão, Reservas, Convidados): the
// numbers and filter options, and a page filtered by the API.
@RequireModule(AppModule.BOOKINGS)
@Resolver()
export class DayGuestsResolver {
  constructor(
    private readonly listing: ListDayGuestsUseCase,
    private readonly overview: GetDayGuestsOverviewUseCase,
  ) {}

  @RequirePermissions(Permission.GUESTS_CHECKIN)
  @Query(() => GateGuestPage, {
    description:
      "Os convidados das reservas de um dia, com filtros, por página.",
  })
  async dayGuests(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("date", dateArg) date: string | null,
    @Args("filter", { type: () => DayGuestFilterInput, nullable: true })
    filter?: DayGuestFilterInput | null,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<GateGuestType>> {
    const result = await this.listing.execute(
      actor,
      date?.slice(0, 10) ?? null,
      {
        guestId: filter?.guestId ?? null,
        hostId: filter?.hostId ?? null,
        unitId: filter?.unitId ?? null,
        spaceId: filter?.spaceId ?? null,
        checkedIn: filter?.checkedIn ?? null,
      },
      page ?? DEFAULT_PAGE,
    );
    return { ...result, items: result.items.map(toGateGuestType) };
  }

  @RequirePermissions(Permission.GUESTS_CHECKIN)
  @Query(() => DayGuestsOverviewType, {
    description: "Os números dos convidados de um dia e as opções dos filtros.",
  })
  dayGuestsOverview(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("date", dateArg) date: string | null,
  ): Promise<DayGuestsOverviewType> {
    return this.overview.execute(actor, date?.slice(0, 10) ?? null);
  }
}
