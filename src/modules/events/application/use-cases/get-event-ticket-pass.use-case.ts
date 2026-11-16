import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  EVENT_TICKET_REPOSITORY,
  type EventTicketRepositoryPort,
} from "@/modules/events/application/ports/event-ticket-repository.port";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import {
  normalizeTicketCode,
  ticketPassStatus,
  type TicketPassStatus,
} from "@/modules/events/domain/event-ticket-entry";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";
import { rateStatus, type RateRule } from "@/shared/domain/rate-limit";

/** Tickets opened per connection (guessing codes stays impractical). */
export const TICKET_PASS_LIMIT: RateRule = { limit: 60, windowMs: 10 * 60_000 };

/** What the ticket's page shows: nothing about the buyer but the first name. */
export type EventTicketPass = {
  code: string;
  name: string;
  ticketName: string | null;
  eventTitle: string;
  placeName: string;
  condominiumName: string;
  startsAt: Date;
  endsAt: Date;
  buyerFirstName: string | null;
  status: TicketPassStatus;
  checkedIn: boolean;
};

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// The public page of a ticket (the link the buyer shares with a guest who
// has no account). The code is the key: 10 characters from 31 symbols, and
// each connection opens at most 60 tickets per 10 minutes. Only tickets of
// confirmed orders exist here.
@Injectable()
export class GetEventTicketPassUseCase {
  constructor(
    @Inject(EVENT_TICKET_REPOSITORY)
    private readonly tickets: EventTicketRepositoryPort,
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    rawCode: string,
    ip: string | null,
  ): Promise<EventTicketPass | null> {
    const window = await this.limits.hit(
      `event-ticket:${this.secrets.digest(ip ?? "unknown")}`,
      TICKET_PASS_LIMIT.windowMs,
    );
    const status = rateStatus(
      { ...window, count: window.count - 1 },
      TICKET_PASS_LIMIT,
      this.clock.now(),
    );
    if (status.blocked) {
      throw AppException.from(APP_ERRORS.identity.tooManyRequests, {
        minutes: status.retryAfterMinutes,
      });
    }

    const code = normalizeTicketCode(rawCode);
    const ticket = code ? await this.tickets.findByCode(code) : null;
    if (!ticket || ticket.orderStatus !== EventOrderStatus.CONFIRMED) {
      return null;
    }
    return {
      code: ticket.ticketCode,
      name: ticket.name,
      ticketName: ticket.ticketName,
      eventTitle: ticket.eventTitle,
      placeName: ticket.placeName,
      condominiumName: ticket.condominiumName,
      startsAt: ticket.startsAt,
      endsAt: ticket.endsAt,
      buyerFirstName: ticket.buyerName ? firstName(ticket.buyerName) : null,
      status: ticketPassStatus(ticket, this.clock.now()),
      checkedIn: ticket.checkedInAt !== null,
    };
  }
}
