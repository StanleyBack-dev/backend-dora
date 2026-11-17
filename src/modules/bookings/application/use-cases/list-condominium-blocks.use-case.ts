import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import {
  SPACE_BLOCK_REPOSITORY,
  type SpaceBlockRepositoryPort,
  type SpaceBlockView,
} from "@/modules/bookings/application/ports/space-block-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The current and upcoming blocks of every space of the condominium, for its
// managers (Gestão, Reservas, Bloqueios), soonest first.
@Injectable()
export class ListCondominiumBlocksUseCase {
  constructor(
    @Inject(SPACE_BLOCK_REPOSITORY)
    private readonly blocks: SpaceBlockRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute(actor: AuthenticatedUser): Promise<SpaceBlockView[]> {
    return this.blocks.upcomingInCondominium(tenantOf(actor), this.clock.now());
  }
}
