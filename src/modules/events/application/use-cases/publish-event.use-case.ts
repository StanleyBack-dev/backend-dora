import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { EventAccessService } from "@/modules/events/application/event-access.service";
import { publishedNotices } from "@/modules/events/application/event-notices";
import {
  EVENT_REPOSITORY,
  type EventRepositoryPort,
  type EventView,
} from "@/modules/events/application/ports/event-repository.port";
import { EventStatus, isOpen } from "@/modules/events/domain/event";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// A manager publishes a draft: every active member of the condominium is
// told (app, e-mail per their preferences, calendar entry).
@Injectable()
export class PublishEventUseCase {
  constructor(
    @Inject(EVENT_REPOSITORY) private readonly events: EventRepositoryPort,
    private readonly access: EventAccessService,
    private readonly users: UserLookupService,
    private readonly outbox: OutboxDispatcher,
    private readonly audit: AuditTrailService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(actor: AuthenticatedUser, id: string): Promise<EventView> {
    const condominiumId = await this.access.condominiumOf(actor);
    const event = await this.events.find(condominiumId, id);
    if (!event) throw AppException.from(APP_ERRORS.events.notFound, undefined);
    if (event.status === EventStatus.PUBLISHED) {
      throw AppException.from(APP_ERRORS.events.alreadyPublished, undefined);
    }
    const now = this.clock.now();
    if (!isOpen(event, now) || event.startsAt <= now) {
      throw AppException.from(APP_ERRORS.events.closed, undefined);
    }
    const userIds = await this.users.activeMemberIds(condominiumId);
    const published = await this.events.publish(
      id,
      now,
      publishedNotices(event, userIds, this.clock.timeZone),
    );
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "event",
      entityId: id,
    });
    return published;
  }
}
