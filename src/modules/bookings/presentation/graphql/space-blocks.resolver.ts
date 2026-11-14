import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { CreateSpaceBlockUseCase } from "@/modules/bookings/application/use-cases/create-space-block.use-case";
import { DeleteSpaceBlockUseCase } from "@/modules/bookings/application/use-cases/delete-space-block.use-case";
import { ListSpaceBlocksUseCase } from "@/modules/bookings/application/use-cases/list-space-blocks.use-case";
import { toSpaceBlockType } from "@/modules/bookings/presentation/graphql/booking.mapper";
import { CreateSpaceBlockInput } from "@/modules/bookings/presentation/graphql/dto/inputs/create-space-block.input";
import { SpaceBlockType } from "@/modules/bookings/presentation/graphql/dto/outputs/space-block.output";

// Periods a space can't be booked: everyone reads them; managers create
// and remove them.
@Resolver()
export class SpaceBlocksResolver {
  constructor(
    private readonly listing: ListSpaceBlocksUseCase,
    private readonly creating: CreateSpaceBlockUseCase,
    private readonly deleting: DeleteSpaceBlockUseCase,
  ) {}

  @Query(() => [SpaceBlockType], {
    description: "Bloqueios atuais e futuros do espaço.",
  })
  async spaceBlocks(
    @CurrentUser() user: AuthenticatedUser,
    @Args("spaceId", { type: () => ID }, UuidArg()) spaceId: string,
  ): Promise<SpaceBlockType[]> {
    return (await this.listing.execute(user, spaceId)).map(toSpaceBlockType);
  }

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Mutation(() => SpaceBlockType)
  async createSpaceBlock(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateSpaceBlockInput,
  ): Promise<SpaceBlockType> {
    const block = await this.creating.execute(actor, input);
    return toSpaceBlockType({ ...block, createdByName: actor.name });
  }

  @RequirePermissions(Permission.BOOKINGS_MANAGE)
  @Mutation(() => Boolean)
  async deleteSpaceBlock(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<boolean> {
    await this.deleting.execute(actor, id);
    return true;
  }
}
