import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import { cancelledNotices } from "@/modules/events/application/event-notices";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
  type EventView,
} from "@/modules/events/application/ports/event-repository.port";
import {
  EventStatus,
  isOpen,
  normalizeCancelReason,
} from "@/modules/events/domain/event";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// A manager cancels an event that hasn't ended, with a reason. If it was
// published, every member is told (and the calendar entry is removed); a
// draft is just closed.
@Injectable()
export class CancelEventUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    private readonly access: EventAccessService,
    private readonly users: UserLookupService,
    private readonly outbox: OutboxDispatcher,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    rawReason: string,
  ): Promise<EventView> {
    const condominiumId = await this.access.condominiumOf(actor);
    const event = await this.events.find(condominiumId, id);
    if (!event) throw AppException.from(APP_ERRORS.events.notFound, undefined);
    const now = this.clock.now();
    if (!isOpen(event, now)) {
      throw AppException.from(APP_ERRORS.events.closed, undefined);
    }
    const reason = normalizeCancelReason(rawReason);
    if (!reason) {
      throw AppException.from(APP_ERRORS.events.invalidReason, undefined);
    }
    const notices =
      event.status === EventStatus.PUBLISHED
        ? cancelledNotices(
            event,
            await this.users.activeMemberIds(condominiumId),
            reason,
            this.clock.timeZone,
          )
        : [];
    const cancelled = await this.events.cancel(id, reason, now, notices);
    if (notices.length > 0) this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "event",
      entityId: id,
    });
    return cancelled;
  }
}
