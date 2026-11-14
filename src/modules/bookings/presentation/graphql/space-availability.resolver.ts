import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import {
  GetSpaceAvailabilityUseCase,
  type Availability,
} from "@/modules/bookings/application/use-cases/get-space-availability.use-case";
import { SpaceAvailabilityType } from "@/modules/bookings/presentation/graphql/dto/outputs/space-availability.output";

@Resolver()
export class SpaceAvailabilityResolver {
  constructor(private readonly availability: GetSpaceAvailabilityUseCase) {}

  @Query(() => SpaceAvailabilityType, {
    description: "A grade de horários de um espaço em um dia.",
  })
  spaceAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Args("spaceId", { type: () => ID }, UuidArg()) spaceId: string,
    @Args("date", { description: "YYYY-MM-DD." }) date: string,
  ): Promise<Availability> {
    return this.availability.execute(user, spaceId, date.slice(0, 10));
  }
}
