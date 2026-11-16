import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
  type EventView,
} from "@/modules/events/application/ports/event-repository.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The condominium's events: upcoming or past. Residents see the published
// (and cancelled) ones; managers also see their drafts.
@Injectable()
export class ListEventsUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    private readonly access: EventAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    when: "upcoming" | "past",
  ): Promise<EventView[]> {
    const condominiumId = await this.access.condominiumOf(actor);
    const includeDrafts = await this.access.canManage(actor);
    return this.events.list(
      condominiumId,
      { when, includeDrafts },
      this.clock.now(),
    );
  }
}
