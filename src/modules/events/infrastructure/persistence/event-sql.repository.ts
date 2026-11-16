import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type {
  EventListFilter,
  EventRepositoryPort,
  EventView,
} from "@/modules/events/application/ports/event-repository.port";
import { EventStatus, type EventData } from "@/modules/events/domain/event";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";

type EventRow = Omit<EventView, "address"> & {
  addressZip: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
};

const COLUMNS = `
  e.idtb_events AS id, e.idtb_condominiums AS "condominiumId",
  e.title, e.description, e.idtb_spaces AS "spaceId", e.location,
  e.address_zip AS "addressZip", e.address_street AS "addressStreet",
  e.address_number AS "addressNumber",
  e.address_complement AS "addressComplement",
  e.address_district AS "addressDistrict", e.address_city AS "addressCity",
  e.address_state AS "addressState",
  e.starts_at AS "startsAt", e.ends_at AS "endsAt",
  e.capacity, e.external_guest_limit AS "externalGuestLimit",
  e.ticketed, e.status, e.cancel_reason AS "cancelReason",
  e.published_at AS "publishedAt", e.cancelled_at AS "cancelledAt",
  e.created_by AS "createdBy", e.created_at AS "createdAt",
  e.updated_at AS "updatedAt",
  s.name AS "spaceName"`;

// The space's name comes from tb_spaces (spaces module), read-only.
const FROM = `
  FROM tb_events e
  LEFT JOIN tb_spaces s ON s.idtb_spaces = e.idtb_spaces`;

const toView = (row: EventRow): EventView => {
  const {
    addressZip,
    addressStreet,
    addressNumber,
    addressComplement,
    addressDistrict,
    addressCity,
    addressState,
    ...event
  } = row;
  return {
    ...event,
    address:
      addressZip &&
      addressStreet &&
      addressNumber &&
      addressDistrict &&
      addressCity &&
      addressState
        ? {
            zip: addressZip,
            street: addressStreet,
            number: addressNumber,
            complement: addressComplement,
            district: addressDistrict,
            city: addressCity,
            state: addressState,
          }
        : null,
  };
};

/** The values of the columns written from the form ($2 onwards). */
const dataParams = (data: EventData) => [
  data.title,
  data.description,
  data.spaceId,
  data.location,
  data.address?.zip ?? null,
  data.address?.street ?? null,
  data.address?.number ?? null,
  data.address?.complement ?? null,
  data.address?.district ?? null,
  data.address?.city ?? null,
  data.address?.state ?? null,
  data.startsAt,
  data.endsAt,
  data.capacity,
  data.externalGuestLimit,
  data.ticketed,
];

// Events are plain records: raw SQL; publishing and cancelling store their
// notices in the outbox in the same transaction.
@Injectable()
export class EventSqlRepository implements EventRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async list(
    condominiumId: string,
    filter: EventListFilter,
    now: Date,
  ): Promise<EventView[]> {
    const upcoming = filter.when === "upcoming";
    const rows = await this.dataSource.query<EventRow[]>(
      `SELECT ${COLUMNS} ${FROM}
        WHERE e.idtb_condominiums = $1
          AND ${upcoming ? "e.ends_at >= $2" : "e.ends_at < $2"}
          AND ($3 OR e.status <> '${EventStatus.DRAFT}')
        ORDER BY e.starts_at ${upcoming ? "ASC" : "DESC"}
        LIMIT 100`,
      [condominiumId, now, filter.includeDrafts],
    );
    return rows.map(toView);
  }

  async find(condominiumId: string, id: string): Promise<EventView | null> {
    const [row] = await this.dataSource.query<EventRow[]>(
      `SELECT ${COLUMNS} ${FROM}
        WHERE e.idtb_condominiums = $1 AND e.idtb_events = $2`,
      [condominiumId, id],
    );
    return row ? toView(row) : null;
  }

  async create(
    condominiumId: string,
    data: EventData,
    createdBy: string,
  ): Promise<EventView> {
    const [row] = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO tb_events
         (idtb_condominiums, title, description, idtb_spaces, location,
          address_zip, address_street, address_number, address_complement,
          address_district, address_city, address_state,
          starts_at, ends_at, capacity, external_guest_limit, ticketed,
          created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15, $16, $17, $18, $18)
       RETURNING idtb_events AS id`,
      [condominiumId, ...dataParams(data), createdBy],
    );
    return this.get(this.dataSource.manager, row.id);
  }

  async update(id: string, data: EventData): Promise<EventView> {
    await this.dataSource.query(
      `UPDATE tb_events
          SET title = $2, description = $3, idtb_spaces = $4, location = $5,
              address_zip = $6, address_street = $7, address_number = $8,
              address_complement = $9, address_district = $10,
              address_city = $11, address_state = $12,
              starts_at = $13, ends_at = $14, capacity = $15,
              external_guest_limit = $16, ticketed = $17, updated_at = now()
        WHERE idtb_events = $1`,
      [id, ...dataParams(data)],
    );
    return this.get(this.dataSource.manager, id);
  }

  publish(id: string, at: Date, notices: OutboxDraft[]): Promise<EventView> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE tb_events
            SET status = '${EventStatus.PUBLISHED}', published_at = $2,
                updated_at = now()
          WHERE idtb_events = $1`,
        [id, at],
      );
      await this.outbox.write(manager, notices);
      return this.get(manager, id);
    });
  }

  cancel(
    id: string,
    reason: string,
    at: Date,
    notices: OutboxDraft[],
  ): Promise<EventView> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE tb_events
            SET status = '${EventStatus.CANCELLED}', cancel_reason = $2,
                cancelled_at = $3, updated_at = now()
          WHERE idtb_events = $1`,
        [id, reason, at],
      );
      if (notices.length > 0) await this.outbox.write(manager, notices);
      return this.get(manager, id);
    });
  }

  private async get(manager: EntityManager, id: string): Promise<EventView> {
    const [row] = await manager.query<EventRow[]>(
      `SELECT ${COLUMNS} ${FROM} WHERE e.idtb_events = $1`,
      [id],
    );
    return toView(row);
  }
}
