import { Args, ID, Mutation, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import {
  CancelBookingSeriesUseCase,
  type SeriesCancellation,
} from "@/modules/bookings/application/use-cases/cancel-booking-series.use-case";
import { CreateBookingSeriesUseCase } from "@/modules/bookings/application/use-cases/create-booking-series.use-case";
import { toBookingType } from "@/modules/bookings/presentation/graphql/booking.mapper";
import { CreateBookingSeriesInput } from "@/modules/bookings/presentation/graphql/dto/inputs/create-booking-series.input";
import { BookingSeriesResultType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking-series-result.output";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import { SeriesCancellationType } from "@/modules/bookings/presentation/graphql/dto/outputs/series-cancellation.output";

// Weekly bookings: the same slot for several weeks.
@RequireModule(AppModule.BOOKINGS)
@Resolver()
export class BookingSeriesResolver {
  constructor(
    private readonly creating: CreateBookingSeriesUseCase,
    private readonly cancelling: CancelBookingSeriesUseCase,
  ) {}

  @RequirePermissions(Permission.BOOKINGS_CREATE)
  @Mutation(() => BookingSeriesResultType, {
    description:
      "Reserva o mesmo horário toda semana; datas que não puderem ser reservadas são puladas.",
  })
  async createBookingSeries(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateBookingSeriesInput,
  ): Promise<BookingSeriesResultType> {
    const result = await this.creating.execute(actor, input);
    return {
      seriesId: result.seriesId,
      created: result.created.map(toBookingType),
      skipped: result.skipped,
    };
  }

  @Mutation(() => SeriesCancellationType, {
    description:
      "Cancela as próximas datas de uma reserva recorrente (as fora do prazo ficam, para moradores).",
  })
  cancelBookingSeries(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("seriesId", { type: () => ID }, UuidArg()) seriesId: string,
  ): Promise<SeriesCancellation> {
    return this.cancelling.execute(actor, seriesId);
  }
}
