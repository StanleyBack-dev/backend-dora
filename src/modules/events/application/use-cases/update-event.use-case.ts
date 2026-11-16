import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import { EventInputService } from "@/modules/events/application/event-input.service";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
  type EventView,
} from "@/modules/events/application/ports/event-repository.port";
import { isOpen, type EventInput } from "@/modules/events/domain/event";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// A manager edits an event that is still open (not over, not cancelled).
// Published events change silently: residents see the new details in the
// app (notices for changes can come later, with tickets).
@Injectable()
export class UpdateEventUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    private readonly access: EventAccessService,
    private readonly input: EventInputService,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    input: EventInput,
  ): Promise<EventView> {
    const condominiumId = await this.access.condominiumOf(actor);
    const event = await this.events.find(condominiumId, id);
    if (!event) throw AppException.from(APP_ERRORS.events.notFound, undefined);
    if (!isOpen(event, this.clock.now())) {
      throw AppException.from(APP_ERRORS.events.closed, undefined);
    }
    const data = await this.input.validate(condominiumId, input);
    const updated = await this.events.update(id, data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "event",
      entityId: id,
    });
    return updated;
  }
}
