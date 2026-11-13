import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { BroadcastsUseCase } from "@/modules/broadcasts/application/use-cases/broadcasts.use-case";
import type { BroadcastView } from "@/modules/broadcasts/application/ports/broadcast-repository.port";
import { BroadcastType } from "@/modules/broadcasts/presentation/graphql/dto/outputs/broadcast.output";
import { BroadcastInput } from "@/modules/broadcasts/presentation/graphql/dto/inputs/broadcast.input";

@Resolver()
export class BroadcastsResolver {
  constructor(private readonly broadcastsUseCase: BroadcastsUseCase) {}

  @RequirePermissions(Permission.NOTIFICATIONS_BROADCAST)
  @Query(() => [BroadcastType], { description: "Últimos 50 comunicados." })
  broadcasts(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<BroadcastView[]> {
    return this.broadcastsUseCase.list(actor);
  }

  @RequirePermissions(Permission.NOTIFICATIONS_BROADCAST)
  @Mutation(() => BroadcastType)
  sendBroadcast(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: BroadcastInput,
  ): Promise<BroadcastView> {
    return this.broadcastsUseCase.send(actor, input);
  }
}
