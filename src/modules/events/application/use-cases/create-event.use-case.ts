import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import { EventInputService } from "@/modules/events/application/event-input.service";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
  type EventView,
} from "@/modules/events/application/ports/event-repository.port";
import type { EventInput } from "@/modules/events/domain/event";

// A manager creates an event as a draft: nobody else sees it until it is
// published.
@Injectable()
export class CreateEventUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    private readonly access: EventAccessService,
    private readonly input: EventInputService,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: EventInput,
  ): Promise<EventView> {
    const condominiumId = await this.access.condominiumOf(actor);
    const data = await this.input.validate(condominiumId, input);
    const created = await this.events.create(condominiumId, data, actor.id);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "event",
      entityId: created.id,
      created: true,
    });
    return created;
  }
}
