import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { CheckInGuestUseCase } from "@/modules/bookings/application/use-cases/check-in-guest.use-case";
import { ListGateGuestsUseCase } from "@/modules/bookings/application/use-cases/list-gate-guests.use-case";
import { CheckInGuestInput } from "@/modules/bookings/presentation/graphql/dto/inputs/check-in-guest.input";
import { GateGuestType } from "@/modules/bookings/presentation/graphql/dto/outputs/gate-guest.output";
import { toGateGuestType } from "@/modules/bookings/presentation/graphql/guest.mapper";

// The gate (Portaria): the day's guests and their entry.
@Resolver()
export class GateResolver {
  constructor(
    private readonly listing: ListGateGuestsUseCase,
    private readonly checkingIn: CheckInGuestUseCase,
  ) {}

  @RequirePermissions(Permission.GUESTS_CHECKIN)
  @Query(() => [GateGuestType], {
    description: "Convidados das reservas de um dia (padrão: hoje).",
  })
  async gateGuests(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("date", {
      type: () => String,
      nullable: true,
      description: "YYYY-MM-DD.",
    })
    date: string | null,
  ): Promise<GateGuestType[]> {
    return (await this.listing.execute(actor, date?.slice(0, 10))).map(
      toGateGuestType,
    );
  }

  @RequirePermissions(Permission.GUESTS_CHECKIN)
  @Mutation(() => GateGuestType, {
    description: "Libera a entrada de um convidado (pelo código ou da lista).",
  })
  async checkInGuest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CheckInGuestInput,
  ): Promise<GateGuestType> {
    return toGateGuestType(await this.checkingIn.execute(actor, input));
  }

  @RequirePermissions(Permission.GUESTS_CHECKIN)
  @Mutation(() => GateGuestType, {
    description: "Desfaz a entrada marcada por engano.",
  })
  async undoGuestCheckIn(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("guestId", { type: () => ID }, UuidArg()) guestId: string,
  ): Promise<GateGuestType> {
    return toGateGuestType(
      await this.checkingIn.execute(actor, { guestId }, true),
    );
  }
}
