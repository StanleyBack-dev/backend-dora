import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type {
  EventOrder,
  EventOrderRepositoryPort,
  NewEventOrder,
  OrderLimits,
  OrderRefusal,
} from "@/modules/events/application/ports/event-order-repository.port";
import {
  AttendeeSource,
  EventOrderStatus,
  type Attendee,
} from "@/modules/events/domain/event-order";
import { HOLDING_ORDER } from "@/modules/events/infrastructure/persistence/event-sql.repository";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import type { PixKeyType } from "@/shared/domain/pix";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";

type OrderRow = Omit<EventOrder, "pix" | "attendees" | "unitLabel"> & {
  pixKeyType: PixKeyType | null;
  pixKey: string | null;
  pixReceiverName: string | null;
  pixReceiverCity: string | null;
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
};

type AttendeeRow = Attendee & { id: string; orderId: string };

// The buyer's name and unit come from tb_users and tb_units (identity and
// condominiums), read-only.
const SELECT = `
  SELECT o.idtb_event_orders AS id, o.idtb_condominiums AS "condominiumId",
         o.idtb_events AS "eventId", e.title AS "eventTitle",
         o.idtb_users AS "userId", u.name AS "buyerName",
         o.idtb_units AS "unitId", un.street AS "unitStreet",
         un.block AS "unitBlock", un.number AS "unitNumber",
         o.code, o.status, o.total_cents AS "totalCents",
         o.pix_key_type AS "pixKeyType", o.pix_key AS "pixKey",
         o.pix_receiver_name AS "pixReceiverName",
         o.pix_receiver_city AS "pixReceiverCity",
         o.expires_at AS "expiresAt", o.receipt_key AS "receiptKey",
         o.receipt_content_type AS "receiptContentType",
         o.receipt_sent_at AS "receiptSentAt",
         o.reviewed_by AS "reviewedBy", o.reviewed_at AS "reviewedAt",
         o.reject_reason AS "rejectReason", o.cancelled_at AS "cancelledAt",
         o.created_at AS "createdAt"
    FROM tb_event_orders o
    JOIN tb_events e ON e.idtb_events = o.idtb_events
    LEFT JOIN tb_users u ON u.idtb_users = o.idtb_users
    LEFT JOIN tb_units un ON un.idtb_units = o.idtb_units`;

const toOrder = (row: OrderRow, attendees: AttendeeRow[]): EventOrder => {
  const {
    pixKeyType,
    pixKey,
    pixReceiverName,
    pixReceiverCity,
    unitStreet,
    unitBlock,
    unitNumber,
    ...order
  } = row;
  return {
    ...order,
    unitLabel:
      unitNumber !== null
        ? unitLabel({
            street: unitStreet,
            block: unitBlock ?? "",
            number: unitNumber,
          })
        : null,
    pix:
      pixKeyType && pixKey && pixReceiverName && pixReceiverCity
        ? {
            keyType: pixKeyType,
            key: pixKey,
            name: pixReceiverName,
            city: pixReceiverCity,
          }
        : null,
    attendees: attendees
      .filter((person) => person.orderId === row.id)
      .map((person) => {
        const { orderId, ...rest } = person;
        void orderId;
        return rest;
      }),
  };
};

// Orders and their people: raw SQL. Creating one locks the event row, so the
// places are counted and taken by one order at a time.
@Injectable()
export class EventOrderSqlRepository implements EventOrderRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  create(
    order: NewEventOrder,
    limits: OrderLimits,
    notices: OutboxDraft[],
  ): Promise<EventOrder | OrderRefusal> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT 1 FROM tb_events WHERE idtb_events = $1 FOR UPDATE`,
        [order.eventId],
      );
      // One ticket per person: the member (SELF in their orders) and each
      // dependent, across the event's active orders.
      const dependentIds = order.attendees
        .map((person) => person.dependentId)
        .filter((id): id is string => id !== null);
      const selfIn = order.attendees.some(
        (person) => person.source === AttendeeSource.SELF,
      );
      const held = await manager.query<{ name: string }[]>(
        `SELECT a.name
           FROM tb_event_attendees a
           JOIN tb_event_orders o ON o.idtb_event_orders = a.idtb_event_orders
          WHERE o.idtb_events = $1 AND ${HOLDING_ORDER}
            AND ((a.source = '${AttendeeSource.SELF}' AND o.idtb_users = $2 AND $3)
                 OR a.idtb_dependents = ANY($4::uuid[]))`,
        [order.eventId, order.userId, selfIn, dependentIds],
      );
      if (held.length > 0) {
        return { held: [...new Set(held.map((row) => row.name))] };
      }

      // Unit limit: the same unit's orders, or the same person's without one.
      const [taken] = await manager.query<
        { places: number; outside: number; mine: number }[]
      >(
        `SELECT count(*)::int AS places,
                count(*) FILTER (WHERE a.outside)::int AS outside,
                count(*) FILTER (WHERE
                  CASE WHEN $2::uuid IS NULL THEN o.idtb_users = $3
                       ELSE o.idtb_units = $2 END)::int AS mine
           FROM tb_event_attendees a
           JOIN tb_event_orders o ON o.idtb_event_orders = a.idtb_event_orders
          WHERE o.idtb_events = $1 AND ${HOLDING_ORDER}`,
        [order.eventId, order.unitId, order.userId],
      );
      const adding = order.attendees.length;
      const addingOutside = order.attendees.filter((p) => p.outside).length;
      if (taken.places + adding > limits.capacity) return "full";
      if (taken.outside + addingOutside > limits.externalGuestLimit) {
        return "outside-full";
      }
      if (
        limits.unitTicketLimit !== null &&
        taken.mine + adding > limits.unitTicketLimit
      ) {
        return "unit-limit";
      }

      const [row] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_event_orders
           (idtb_condominiums, idtb_events, idtb_users, idtb_units, code,
            status, total_cents, pix_key_type, pix_key, pix_receiver_name,
            pix_receiver_city, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING idtb_event_orders AS id`,
        [
          order.condominiumId,
          order.eventId,
          order.userId,
          order.unitId,
          order.code,
          order.status,
          order.totalCents,
          order.pix?.keyType ?? null,
          order.pix?.key ?? null,
          order.pix?.name ?? null,
          order.pix?.city ?? null,
          order.expiresAt,
        ],
      );
      for (const [position, person] of order.attendees.entries()) {
        await manager.query(
          `INSERT INTO tb_event_attendees
             (idtb_event_orders, idtb_event_ticket_types, ticket_name, name,
              age, outside, price_cents, position, source, idtb_dependents,
              needs_proof)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            row.id,
            person.ticketTypeId,
            person.ticketName,
            person.name,
            person.age,
            person.outside,
            person.priceCents,
            position,
            person.source,
            person.dependentId,
            person.needsProof,
          ],
        );
      }
      if (notices.length > 0) await this.outbox.write(manager, notices);
      return this.get(manager, row.id);
    });
  }

  async find(condominiumId: string, id: string): Promise<EventOrder | null> {
    const [order] = await this.query(
      this.dataSource.manager,
      `${SELECT} WHERE o.idtb_condominiums = $1 AND o.idtb_event_orders = $2`,
      [condominiumId, id],
    );
    return order ?? null;
  }

  listMine(userId: string, eventId: string): Promise<EventOrder[]> {
    return this.query(
      this.dataSource.manager,
      `${SELECT} WHERE o.idtb_users = $1 AND o.idtb_events = $2
        ORDER BY o.created_at DESC`,
      [userId, eventId],
    );
  }

  listForEvent(
    eventId: string,
    status: EventOrderStatus | null,
  ): Promise<EventOrder[]> {
    return this.query(
      this.dataSource.manager,
      `${SELECT} WHERE o.idtb_events = $1
          AND ($2::varchar IS NULL OR o.status = $2)
        ORDER BY o.created_at
        LIMIT 500`,
      [eventId, status],
    );
  }

  async attachReceipt(
    id: string,
    receipt: { key: string; contentType: string },
    at: Date,
  ): Promise<EventOrder | null> {
    const [rows] = await this.dataSource.query<[unknown[], number]>(
      `UPDATE tb_event_orders
          SET receipt_key = $2, receipt_content_type = $3,
              receipt_sent_at = $4, updated_at = now()
        WHERE idtb_event_orders = $1
          AND status = '${EventOrderStatus.PENDING_PAYMENT}'
          AND expires_at > $4
        RETURNING idtb_event_orders`,
      [id, receipt.key, receipt.contentType, at],
    );
    return rows.length === 0 ? null : this.get(this.dataSource.manager, id);
  }

  async attachProof(
    id: string,
    attendeeId: string,
    proof: { key: string; contentType: string },
    at: Date,
  ): Promise<EventOrder | null> {
    const [rows] = await this.dataSource.query<[unknown[], number]>(
      `UPDATE tb_event_attendees a
          SET proof_key = $3, proof_content_type = $4
         FROM tb_event_orders o
        WHERE a.idtb_event_attendees = $2 AND a.idtb_event_orders = $1
          AND o.idtb_event_orders = a.idtb_event_orders AND a.needs_proof
          AND o.status = '${EventOrderStatus.PENDING_PAYMENT}'
          AND o.expires_at > $5
        RETURNING a.idtb_event_attendees`,
      [id, attendeeId, proof.key, proof.contentType, at],
    );
    return rows.length === 0 ? null : this.get(this.dataSource.manager, id);
  }

  advance(
    id: string,
    at: Date,
    notices: (order: EventOrder) => OutboxDraft[],
  ): Promise<EventOrder | null> {
    return this.dataSource.transaction(async (manager) => {
      const [rows] = await manager.query<[unknown[], number]>(
        `UPDATE tb_event_orders o
            SET status = '${EventOrderStatus.AWAITING_REVIEW}',
                updated_at = now()
          WHERE o.idtb_event_orders = $1
            AND o.status = '${EventOrderStatus.PENDING_PAYMENT}'
            AND o.expires_at > $2
            AND (o.total_cents = 0 OR o.receipt_key IS NOT NULL)
            AND NOT EXISTS (
              SELECT 1 FROM tb_event_attendees a
               WHERE a.idtb_event_orders = o.idtb_event_orders
                 AND a.needs_proof AND a.proof_key IS NULL)
          RETURNING o.idtb_event_orders`,
        [id, at],
      );
      if (rows.length === 0) return null;
      const order = await this.get(manager, id);
      const drafts = notices(order);
      if (drafts.length > 0) await this.outbox.write(manager, drafts);
      return order;
    });
  }

  review(
    id: string,
    decision: {
      status: EventOrderStatus.CONFIRMED | EventOrderStatus.REJECTED;
      reviewerId: string;
      reason: string | null;
      at: Date;
    },
    notices: OutboxDraft[],
  ): Promise<EventOrder | null> {
    return this.dataSource.transaction(async (manager) => {
      const [rows] = await manager.query<[unknown[], number]>(
        `UPDATE tb_event_orders
            SET status = $2, reviewed_by = $3, reviewed_at = $4,
                reject_reason = $5, updated_at = now()
          WHERE idtb_event_orders = $1
            AND status = '${EventOrderStatus.AWAITING_REVIEW}'
          RETURNING idtb_event_orders`,
        [
          id,
          decision.status,
          decision.reviewerId,
          decision.at,
          decision.reason,
        ],
      );
      if (rows.length === 0) return null;
      if (notices.length > 0) await this.outbox.write(manager, notices);
      return this.get(manager, id);
    });
  }

  async cancel(id: string, at: Date): Promise<EventOrder | null> {
    const [rows] = await this.dataSource.query<[unknown[], number]>(
      `UPDATE tb_event_orders
          SET status = '${EventOrderStatus.CANCELLED}', cancelled_at = $2,
              updated_at = now()
        WHERE idtb_event_orders = $1
          AND status = '${EventOrderStatus.PENDING_PAYMENT}'
        RETURNING idtb_event_orders`,
      [id, at],
    );
    return rows.length === 0 ? null : this.get(this.dataSource.manager, id);
  }

  async expire(now: Date): Promise<number> {
    const [, count] = await this.dataSource.query<[unknown[], number]>(
      `UPDATE tb_event_orders
          SET status = '${EventOrderStatus.EXPIRED}', updated_at = now()
        WHERE status = '${EventOrderStatus.PENDING_PAYMENT}'
          AND expires_at <= $1`,
      [now],
    );
    return count;
  }

  private async get(manager: EntityManager, id: string): Promise<EventOrder> {
    const [order] = await this.query(
      manager,
      `${SELECT} WHERE o.idtb_event_orders = $1`,
      [id],
    );
    return order;
  }

  private async query(
    manager: EntityManager,
    sql: string,
    params: unknown[],
  ): Promise<EventOrder[]> {
    const rows = await manager.query<OrderRow[]>(sql, params);
    if (rows.length === 0) return [];
    const attendees = await manager.query<AttendeeRow[]>(
      `SELECT idtb_event_attendees AS id, idtb_event_orders AS "orderId",
              idtb_event_ticket_types AS "ticketTypeId",
              ticket_name AS "ticketName", name, age, outside,
              price_cents AS "priceCents", source,
              idtb_dependents AS "dependentId", needs_proof AS "needsProof",
              proof_key AS "proofKey",
              proof_content_type AS "proofContentType"
         FROM tb_event_attendees
        WHERE idtb_event_orders = ANY($1::uuid[])
        ORDER BY position`,
      [rows.map((row) => row.id)],
    );
    return rows.map((row) => toOrder(row, attendees));
  }
}
