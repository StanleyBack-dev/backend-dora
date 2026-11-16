import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type {
  EventListFilter,
  EventRepositoryPort,
  EventView,
} from "@/modules/events/application/ports/event-repository.port";
import { EventStatus, type EventData } from "@/modules/events/domain/event";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import {
  priceOf,
  TICKET_KIND_LABELS,
  type EventPixSource,
  type TicketKind,
  type TicketPriceMode,
  type TicketType,
} from "@/modules/events/domain/event-tickets";
import type { PixKeyType } from "@/shared/domain/pix";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";

type EventRow = Omit<
  EventView,
  "address" | "ticketTypes" | "customPix" | "pixSource"
> & {
  addressZip: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressDistrict: string | null;
  addressCity: string | null;
  addressState: string | null;
  pixSource: EventPixSource | null;
  pixKeyType: PixKeyType | null;
  pixKey: string | null;
  pixReceiverName: string | null;
  pixReceiverCity: string | null;
};

type TicketTypeRow = Omit<TicketType, "name" | "priceCents"> & {
  eventId: string;
  kind: TicketKind;
  priceMode: TicketPriceMode;
};

/**
 * Orders that hold places: confirmed, under review, or unpaid and still
 * within their 48 h (alias `o`).
 */
export const HOLDING_ORDER = `(o.status IN ('${EventOrderStatus.AWAITING_REVIEW}', '${EventOrderStatus.CONFIRMED}')
  OR (o.status = '${EventOrderStatus.PENDING_PAYMENT}' AND o.expires_at > now()))`;

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
  e.ticketed, e.full_price_cents AS "fullPriceCents",
  e.unit_ticket_limit AS "unitTicketLimit",
  e.pix_source AS "pixSource", e.pix_key_type AS "pixKeyType",
  e.pix_key AS "pixKey",
  e.pix_receiver_name AS "pixReceiverName",
  e.pix_receiver_city AS "pixReceiverCity",
  e.sales_close AS "salesClose", e.sales_close_hours AS "salesCloseHours",
  e.status, e.cancel_reason AS "cancelReason",
  e.published_at AS "publishedAt", e.cancelled_at AS "cancelledAt",
  e.created_by AS "createdBy", e.created_at AS "createdAt",
  e.updated_at AS "updatedAt",
  s.name AS "spaceName",
  (SELECT count(*)::int FROM tb_event_attendees a
     JOIN tb_event_orders o ON o.idtb_event_orders = a.idtb_event_orders
    WHERE o.idtb_events = e.idtb_events AND ${HOLDING_ORDER}) AS "heldPlaces",
  (SELECT count(*)::int FROM tb_event_attendees a
     JOIN tb_event_orders o ON o.idtb_event_orders = a.idtb_event_orders
    WHERE o.idtb_events = e.idtb_events AND a.outside
      AND ${HOLDING_ORDER}) AS "heldOutside"`;

// The space's name comes from tb_spaces (spaces module), read-only.
const FROM = `
  FROM tb_events e
  LEFT JOIN tb_spaces s ON s.idtb_spaces = e.idtb_spaces`;

const toView = (row: EventRow, types: TicketType[]): EventView => {
  const {
    addressZip,
    addressStreet,
    addressNumber,
    addressComplement,
    addressDistrict,
    addressCity,
    addressState,
    pixKeyType,
    pixKey,
    pixReceiverName,
    pixReceiverCity,
    ...event
  } = row;
  return {
    ...event,
    ticketTypes: types,
    customPix:
      pixKeyType && pixKey && pixReceiverName && pixReceiverCity
        ? {
            keyType: pixKeyType,
            key: pixKey,
            name: pixReceiverName,
            city: pixReceiverCity,
          }
        : null,
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
  data.fullPriceCents,
  data.unitTicketLimit,
  data.pixSource,
  data.customPix?.keyType ?? null,
  data.customPix?.key ?? null,
  data.customPix?.name ?? null,
  data.customPix?.city ?? null,
  data.salesClose,
  data.salesCloseHours,
];

// Events are plain records: raw SQL. The event and its ticket types are
// written together; publishing and cancelling store their notices in the
// outbox in the same transaction.
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
    return this.withTypes(this.dataSource.manager, rows);
  }

  async find(condominiumId: string, id: string): Promise<EventView | null> {
    const rows = await this.dataSource.query<EventRow[]>(
      `SELECT ${COLUMNS} ${FROM}
        WHERE e.idtb_condominiums = $1 AND e.idtb_events = $2`,
      [condominiumId, id],
    );
    const [event] = await this.withTypes(this.dataSource.manager, rows);
    return event ?? null;
  }

  create(
    condominiumId: string,
    data: EventData,
    createdBy: string,
  ): Promise<EventView> {
    return this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_events
           (idtb_condominiums, title, description, idtb_spaces, location,
            address_zip, address_street, address_number, address_complement,
            address_district, address_city, address_state,
            starts_at, ends_at, capacity, external_guest_limit, ticketed,
            full_price_cents, unit_ticket_limit, pix_source, pix_key_type,
            pix_key, pix_receiver_name, pix_receiver_city, sales_close,
            sales_close_hours, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
                 $27, $27)
         RETURNING idtb_events AS id`,
        [condominiumId, ...dataParams(data), createdBy],
      );
      await this.syncTypes(manager, row.id, data);
      return this.get(manager, row.id);
    });
  }

  update(id: string, data: EventData): Promise<EventView> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `UPDATE tb_events
            SET title = $2, description = $3, idtb_spaces = $4, location = $5,
                address_zip = $6, address_street = $7, address_number = $8,
                address_complement = $9, address_district = $10,
                address_city = $11, address_state = $12,
                starts_at = $13, ends_at = $14, capacity = $15,
                external_guest_limit = $16, ticketed = $17,
                full_price_cents = $18, unit_ticket_limit = $19,
                pix_source = $20, pix_key_type = $21, pix_key = $22,
                pix_receiver_name = $23, pix_receiver_city = $24,
                sales_close = $25, sales_close_hours = $26,
                updated_at = now()
          WHERE idtb_events = $1`,
        [id, ...dataParams(data)],
      );
      await this.syncTypes(manager, id, data);
      return this.get(manager, id);
    });
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
      // Unpaid orders end with the event (paid ones stay, for the refund).
      await manager.query(
        `UPDATE tb_event_orders
            SET status = '${EventOrderStatus.CANCELLED}', cancelled_at = $2,
                updated_at = now()
          WHERE idtb_events = $1
            AND status = '${EventOrderStatus.PENDING_PAYMENT}'`,
        [id, at],
      );
      if (notices.length > 0) await this.outbox.write(manager, notices);
      return this.get(manager, id);
    });
  }

  /**
   * The event's types as the form sent them: the ones left out go, the ones
   * with an id are updated (orders keep pointing to them), new ones added.
   */
  private async syncTypes(
    manager: EntityManager,
    eventId: string,
    data: EventData,
  ): Promise<void> {
    const kept = data.ticketTypes
      .map((type) => type.id)
      .filter((id): id is string => Boolean(id));
    await manager.query(
      `DELETE FROM tb_event_ticket_types
        WHERE idtb_events = $1 AND NOT (idtb_event_ticket_types = ANY($2::uuid[]))`,
      [eventId, kept],
    );
    // Kinds may swap between kept types: the unique (event, kind) index is
    // checked at commit (DEFERRABLE).
    for (const [position, type] of data.ticketTypes.entries()) {
      const params = [
        eventId,
        type.kind,
        type.priceMode,
        type.customPriceCents,
        type.minAge,
        type.maxAge,
        position,
      ];
      const [updated] = type.id
        ? await manager.query<[unknown[], number]>(
            `UPDATE tb_event_ticket_types
                SET kind = $2, price_mode = $3, custom_price_cents = $4,
                    min_age = $5, max_age = $6, position = $7
              WHERE idtb_events = $1 AND idtb_event_ticket_types = $8
              RETURNING idtb_event_ticket_types`,
            [...params, type.id],
          )
        : [[]];
      if (updated.length === 0) {
        // New (or an id of another event: treated as new).
        await manager.query(
          `INSERT INTO tb_event_ticket_types
             (idtb_events, kind, price_mode, custom_price_cents, min_age,
              max_age, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          params,
        );
      }
    }
  }

  private async withTypes(
    manager: EntityManager,
    rows: EventRow[],
  ): Promise<EventView[]> {
    if (rows.length === 0) return [];
    const types = await manager.query<TicketTypeRow[]>(
      `SELECT idtb_event_ticket_types AS id, idtb_events AS "eventId", kind,
              price_mode AS "priceMode",
              custom_price_cents AS "customPriceCents", min_age AS "minAge",
              max_age AS "maxAge"
         FROM tb_event_ticket_types
        WHERE idtb_events = ANY($1::uuid[])
        ORDER BY position, created_at`,
      [rows.map((row) => row.id)],
    );
    return rows.map((row) =>
      toView(
        row,
        types
          .filter((type) => type.eventId === row.id)
          .map((type) => ({
            id: type.id,
            kind: type.kind,
            name: TICKET_KIND_LABELS[type.kind],
            priceMode: type.priceMode,
            customPriceCents: type.customPriceCents,
            priceCents: priceOf(type, row.fullPriceCents ?? 0),
            minAge: type.minAge,
            maxAge: type.maxAge,
          })),
      ),
    );
  }

  private async get(manager: EntityManager, id: string): Promise<EventView> {
    const rows = await manager.query<EventRow[]>(
      `SELECT ${COLUMNS} ${FROM} WHERE e.idtb_events = $1`,
      [id],
    );
    const [event] = await this.withTypes(manager, rows);
    return event;
  }
}
