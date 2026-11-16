import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import {
  EVENT_TICKET_REPOSITORY,
  type EventTicket,
  type EventTicketRepositoryPort,
} from "@/modules/events/application/ports/event-ticket-repository.port";
import {
  entryDenial,
  type EntryDenial,
} from "@/modules/events/domain/event-ticket-entry";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { addDays, isLocalDate } from "@/shared/domain/local-date";

/** A ticket on the gate's list, with whether it can come in now. */
export type GateTicket = EventTicket & { entryDenial: EntryDenial | null };

// The gate's list of event tickets (Portaria): the people of the confirmed
// orders of the day's events (today by default). Without the events module
// the list is just empty: the gate page also serves booking guests.
@Injectable()
export class ListGateEventTicketsUseCase {
  constructor(
    @Inject(EVENT_TICKET_REPOSITORY)
    private readonly tickets: EventTicketRepositoryPort,
    private readonly modules: ModuleAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    date?: string | null,
  ): Promise<GateTicket[]> {
    const condominiumId = tenantOf(actor);
    if (
      !(await this.modules.enabled(condominiumId)).includes(AppModule.EVENTS)
    ) {
      return [];
    }
    const now = this.clock.now();
    const day = date ?? this.clock.localDate(now);
    if (!isLocalDate(day)) {
      throw AppException.from(APP_ERRORS.events.invalidGateDate, undefined);
    }
    const rows = await this.tickets.forGate(
      condominiumId,
      this.clock.startOfLocalDate(day),
      this.clock.startOfLocalDate(addDays(day, 1)),
    );
    return rows.map((ticket) => ({
      ...ticket,
      entryDenial: entryDenial(ticket, now),
    }));
  }
}
