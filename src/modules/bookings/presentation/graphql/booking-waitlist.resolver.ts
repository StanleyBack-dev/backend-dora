import { Args, Mutation, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { JoinWaitlistUseCase } from "@/modules/bookings/application/use-cases/join-waitlist.use-case";
import { LeaveWaitlistUseCase } from "@/modules/bookings/application/use-cases/leave-waitlist.use-case";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import { WaitlistSlotInput } from "@/modules/bookings/presentation/graphql/dto/inputs/waitlist-slot.input";

// The waiting list of a taken slot.
@RequireModule(AppModule.BOOKINGS)
@Resolver()
export class BookingWaitlistResolver {
  constructor(
    private readonly joining: JoinWaitlistUseCase,
    private readonly leaving: LeaveWaitlistUseCase,
  ) {}

  @RequirePermissions(Permission.BOOKINGS_CREATE)
  @Mutation(() => Boolean, {
    description:
      "Entra na lista de espera de um horário reservado: se for liberado, você é avisado.",
  })
  async joinWaitlist(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: WaitlistSlotInput,
  ): Promise<boolean> {
    await this.joining.execute(actor, input.spaceId, input.startsAt);
    return true;
  }

  @Mutation(() => Boolean, { description: "Sai da lista de espera." })
  async leaveWaitlist(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: WaitlistSlotInput,
  ): Promise<boolean> {
    await this.leaving.execute(actor, input.spaceId, input.startsAt);
    return true;
  }
}
