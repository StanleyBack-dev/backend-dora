import { Args, Query, Resolver } from "@nestjs/graphql";
import { Public } from "@/common/decorators/public.decorator";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import {
  GetGuestInviteUseCase,
  type GuestInvite,
} from "@/modules/bookings/application/use-cases/get-guest-invite.use-case";
import { GuestInviteType } from "@/modules/bookings/presentation/graphql/dto/outputs/guest-invite.output";

// The public page of a guest's invite (the link shared by WhatsApp).
@Resolver()
export class GuestInviteResolver {
  constructor(private readonly invites: GetGuestInviteUseCase) {}

  @Public()
  @Query(() => GuestInviteType, {
    nullable: true,
    description: "Convite de um convidado pelo código (null: não existe).",
  })
  guestInvite(
    @Args("code") code: string,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<GuestInvite | null> {
    return this.invites.execute(code.slice(0, 20), meta.ipAddress);
  }
}
