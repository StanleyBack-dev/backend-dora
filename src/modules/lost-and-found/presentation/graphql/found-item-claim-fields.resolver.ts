import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { FoundItemClaimType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-claim.output";
import { FoundItemType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item.output";
import { toFoundItemType } from "@/modules/lost-and-found/presentation/graphql/found-item.mapper";

// A claim's item, for the desk's queue: what the item fields show depends
// on who asks (the photo, the private details), as on the item itself.
@Resolver(() => FoundItemClaimType)
export class FoundItemClaimFieldsResolver {
  constructor(private readonly access: LostFoundAccessService) {}

  @ResolveField(() => FoundItemType, { description: "O item pedido." })
  async item(
    @Parent() claim: FoundItemClaimType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<FoundItemType> {
    return toFoundItemType(await this.access.loadVisible(actor, claim.itemId));
  }
}
