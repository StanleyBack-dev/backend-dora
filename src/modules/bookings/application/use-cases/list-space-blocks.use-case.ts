import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { BookingAccessService } from "@/modules/bookings/application/booking-access.service";
import {
  SPACE_BLOCK_REPOSITORY,
  type SpaceBlockRepositoryPort,
  type SpaceBlockView,
} from "@/modules/bookings/application/ports/space-block-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// Current and upcoming blocks of a space: every member sees them (so they
// know why a day is closed).
@Injectable()
export class ListSpaceBlocksUseCase {
  constructor(
    @Inject(SPACE_BLOCK_REPOSITORY)
    private readonly blocks: SpaceBlockRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly spaces: SpaceForBooking,
    private readonly access: BookingAccessService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    spaceId: string,
  ): Promise<SpaceBlockView[]> {
    const manager = await this.access.canManage(actor);
    const space = await this.spaces.load(actor, spaceId, manager);
    return this.blocks.upcoming(space.id, this.clock.now());
  }
}
