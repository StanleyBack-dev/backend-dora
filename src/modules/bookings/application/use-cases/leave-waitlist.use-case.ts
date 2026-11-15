import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import {
  WAITLIST_REPOSITORY,
  type WaitlistRepositoryPort,
} from "@/modules/bookings/application/ports/waitlist-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";

// Stops waiting for a slot (not on the list: nothing changes).
@Injectable()
export class LeaveWaitlistUseCase {
  constructor(
    @Inject(WAITLIST_REPOSITORY)
    private readonly waitlist: WaitlistRepositoryPort,
    private readonly spaces: SpaceForBooking,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    spaceId: string,
    startsAt: Date,
  ): Promise<void> {
    const space = await this.spaces.load(actor, spaceId, true);
    await this.waitlist.leave(space.id, startsAt, actor.id);
  }
}
