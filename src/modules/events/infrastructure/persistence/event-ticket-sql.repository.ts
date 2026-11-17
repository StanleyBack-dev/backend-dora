import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  EventTicket,
  EventTicketFilter,
  EventTicketRepositoryPort,
} from "@/modules/events/application/ports/event-ticket-repository.port";
import { EventStatus } from "@/modules/events/domain/event";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import { AttendeeSource } from "@/modules/events/domain/event-order";
import { likePattern } from "@/shared/infrastructure/persistence/like-pattern";

type TicketRow = Omit<EventTicket, "unitLabel"> & {
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
};

// The condominium, space, buyer and unit come from their modules' tables
// (condominiums, spaces, identity), read-only.
const SELECT = `
  SELECT a.idtb_event_attendees AS id, o.idtb_condominiums AS "condominiumId",
         c.name AS "condominiumName", e.idtb_events AS "eventId",
         e.title AS "eventTitle", e.status AS "eventStatus",
         e.starts_at AS "startsAt", e.ends_at AS "endsAt",
         COALESCE(s.name, e.location, '') AS "placeName",
         o.idtb_event_orders AS "orderId", o.code AS "orderCode",
         o.status AS "orderStatus", u.name AS "buyerName",
         un.street AS "unitStreet", un.block AS "unitBlock",
         un.number AS "unitNumber",
         a.name, a.age, a.outside, a.source, a.ticket_name AS "ticketName",
         a.ticket_code AS "ticketCode", a.checked_in_at AS "checkedInAt"
    FROM tb_event_attendees a
    JOIN tb_event_orders o ON o.idtb_event_orders = a.idtb_event_orders
    JOIN tb_events e ON e.idtb_events = o.idtb_events
    JOIN tb_condominiums c ON c.idtb_condominiums = o.idtb_condominiums
    LEFT JOIN tb_spaces s ON s.idtb_spaces = e.idtb_spaces
    LEFT JOIN tb_users u ON u.idtb_users = o.idtb_users
    LEFT JOIN tb_units un ON un.idtb_units = o.idtb_units`;

const toTicket = (row: TicketRow): EventTicket => {
  const { unitStreet, unitBlock, unitNumber, ...ticket } = row;
  return {
    ...ticket,
    unitLabel:
      unitNumber !== null
        ? unitLabel({
            street: unitStreet,
            block: unitBlock ?? "",
            number: unitNumber,
          })
        : null,
  };
};

// Tickets at the gate: raw SQL over the orders' people.
@Injectable()
export class EventTicketSqlRepository implements EventTicketRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async forGate(
    condominiumId: string,
    from: Date,
    to: Date,
  ): Promise<EventTicket[]> {
    const rows = await this.dataSource.query<TicketRow[]>(
      `${SELECT}
        WHERE o.idtb_condominiums = $1
          AND o.status = '${EventOrderStatus.CONFIRMED}'
          AND e.status IN ('${EventStatus.PUBLISHED}', '${EventStatus.CANCELLED}')
          AND e.starts_at < $3 AND e.ends_at > $2
        ORDER BY e.starts_at, e.title, o.created_at, a.position
        LIMIT 2000`,
      [condominiumId, from, to],
    );
    return rows.map(toTicket);
  }

  async forEvent(
    condominiumId: string,
    eventId: string,
    filter: EventTicketFilter,
  ): Promise<EventTicket[]> {
    const params: unknown[] = [condominiumId, eventId];
    const where = [
      "o.idtb_condominiums = $1",
      "o.idtb_events = $2",
      `o.status = '${EventOrderStatus.CONFIRMED}'`,
    ];
    if (filter.search) {
      params.push(likePattern(filter.search));
      const term = `unaccent($${params.length})`;
      where.push(
        `(unaccent(a.name) ILIKE ${term} OR unaccent(COALESCE(u.name, '')) ILIKE ${term}
          OR a.ticket_code ILIKE $${params.length} OR o.code ILIKE $${params.length}
          OR concat_ws(' ', un.street, un.block, un.number) ILIKE $${params.length})`,
      );
    }
    if (filter.checkedIn !== null) {
      where.push(
        filter.checkedIn
          ? "a.checked_in_at IS NOT NULL"
          : "a.checked_in_at IS NULL",
      );
    }
    if (filter.ticketName) {
      params.push(filter.ticketName);
      where.push(`a.ticket_name = $${params.length}`);
    }
    if (filter.outside !== null) {
      params.push(filter.outside);
      where.push(`a.outside = $${params.length}`);
    }
    if (filter.buyer !== null) {
      where.push(
        filter.buyer
          ? `a.source = '${AttendeeSource.SELF}'`
          : `a.source <> '${AttendeeSource.SELF}'`,
      );
    }
    const rows = await this.dataSource.query<TicketRow[]>(
      `${SELECT}
        WHERE ${where.join(" AND ")}
        ORDER BY o.created_at, a.position
        LIMIT 5000`,
      params,
    );
    return rows.map(toTicket);
  }

  async find(
    condominiumId: string,
    attendeeId: string,
  ): Promise<EventTicket | null> {
    const [row] = await this.dataSource.query<TicketRow[]>(
      `${SELECT} WHERE o.idtb_condominiums = $1 AND a.idtb_event_attendees = $2`,
      [condominiumId, attendeeId],
    );
    return row ? toTicket(row) : null;
  }

  async findByCode(code: string): Promise<EventTicket | null> {
    const [row] = await this.dataSource.query<TicketRow[]>(
      `${SELECT} WHERE a.ticket_code = $1`,
      [code],
    );
    return row ? toTicket(row) : null;
  }

  async setCheckIn(
    attendeeId: string,
    at: Date | null,
    by: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE tb_event_attendees
          SET checked_in_at = $2, checked_in_by = $3
        WHERE idtb_event_attendees = $1`,
      [attendeeId, at, at ? by : null],
    );
  }
}
