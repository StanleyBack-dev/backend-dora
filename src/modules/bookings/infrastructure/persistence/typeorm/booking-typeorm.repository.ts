import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { QueryFailedError, type DataSource } from "typeorm";
import {
  SlotTakenError,
  type BookingFilter,
  type BookingPatch,
  type BookingRepositoryPort,
  type BookingView,
  type NewBooking,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  ACTIVE_STATUSES,
  type Booking,
} from "@/modules/bookings/domain/booking";
import { BookingOrmEntity } from "@/modules/bookings/infrastructure/persistence/typeorm/booking.orm-entity";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const toBooking = (row: BookingOrmEntity): Booking => ({
  id: row.id,
  condominiumId: row.condominiumId,
  spaceId: row.spaceId,
  userId: row.userId,
  unitId: row.unitId,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  status: row.status,
  notes: row.notes,
  cancelUntil: row.cancelUntil,
  decidedBy: row.decidedBy,
  decidedAt: row.decidedAt,
  reason: row.reason,
  cancelledBy: row.cancelledBy,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
});

// Names come from tb_spaces, tb_users and tb_units (other modules), read-only.
const VIEW_SQL = `
  SELECT b.idtb_bookings AS id, b.idtb_condominiums AS "condominiumId",
         b.idtb_spaces AS "spaceId", b.idtb_users AS "userId",
         b.idtb_units AS "unitId", b.starts_at AS "startsAt",
         b.ends_at AS "endsAt", b.status, b.notes,
         b.cancel_until AS "cancelUntil", b.decided_by AS "decidedBy",
         b.decided_at AS "decidedAt", b.reason,
         b.cancelled_by AS "cancelledBy", b.cancelled_at AS "cancelledAt",
         b.created_at AS "createdAt",
         s.name AS "spaceName", s.kind AS "spaceKind", u.name AS "userName",
         un.block AS "unitBlock", un.number AS "unitNumber"
    FROM tb_bookings b
    JOIN tb_spaces s ON s.idtb_spaces = b.idtb_spaces
    JOIN tb_users u ON u.idtb_users = b.idtb_users
    LEFT JOIN tb_units un ON un.idtb_units = b.idtb_units`;

const ACTIVE_SQL = ACTIVE_STATUSES.map((status) => `'${status}'`).join(", ");

const isExclusionViolation = (error: unknown) =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string } | undefined)?.code === "23P01";

@Injectable()
export class BookingTypeormRepository implements BookingRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async create(
    data: NewBooking,
    notices: (booking: Booking) => OutboxDraft[],
  ): Promise<BookingView> {
    let id: string;
    try {
      id = await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(BookingOrmEntity);
        const saved = await repository.save(repository.create(data));
        await this.outbox.write(manager, notices(toBooking(saved)));
        return saved.id;
      });
    } catch (error) {
      if (isExclusionViolation(error)) throw new SlotTakenError();
      throw error;
    }
    return this.mustFind(id);
  }

  async find(condominiumId: string, id: string): Promise<BookingView | null> {
    const rows = await this.dataSource.query<BookingView[]>(
      `${VIEW_SQL} WHERE b.idtb_bookings = $1 AND b.idtb_condominiums = $2`,
      [id, condominiumId],
    );
    return rows[0] ?? null;
  }

  async update(
    id: string,
    patch: BookingPatch,
    notices: OutboxDraft[],
  ): Promise<BookingView> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(BookingOrmEntity).update({ id }, patch);
      await this.outbox.write(manager, notices);
    });
    return this.mustFind(id);
  }

  activeInRange(spaceId: string, from: Date, to: Date): Promise<BookingView[]> {
    return this.dataSource.query<BookingView[]>(
      `${VIEW_SQL}
        WHERE b.idtb_spaces = $1 AND b.status IN (${ACTIVE_SQL})
          AND b.starts_at < $3 AND b.ends_at > $2
        ORDER BY b.starts_at`,
      [spaceId, from, to],
    );
  }

  async countUnitActive(
    spaceId: string,
    unitId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const [row] = await this.dataSource.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM tb_bookings
        WHERE idtb_spaces = $1 AND idtb_units = $2
          AND status IN (${ACTIVE_SQL})
          AND starts_at >= $3 AND starts_at < $4`,
      [spaceId, unitId, from, to],
    );
    return row?.count ?? 0;
  }

  async page(
    filter: BookingFilter,
    page: PageRequest,
  ): Promise<Paginated<BookingView>> {
    const where = ["b.idtb_condominiums = $1"];
    const params: unknown[] = [filter.condominiumId];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace("?", `$${params.length}`));
    };
    if (filter.spaceId) add("b.idtb_spaces = ?", filter.spaceId);
    if (filter.userId) add("b.idtb_users = ?", filter.userId);
    if (filter.status) add("b.status = ?", filter.status);
    if (filter.from) add("b.starts_at >= ?", filter.from);
    if (filter.to) add("b.starts_at < ?", filter.to);
    if (filter.when === "UPCOMING") where.push("b.ends_at > now()");
    if (filter.when === "PAST") where.push("b.ends_at <= now()");
    const order = filter.when === "PAST" ? "DESC" : "ASC";
    const clause = `WHERE ${where.join(" AND ")}`;

    const [rows, [count]] = await Promise.all([
      this.dataSource.query<BookingView[]>(
        `${VIEW_SQL} ${clause}
          ORDER BY b.starts_at ${order}
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_bookings b ${clause}`,
        params,
      ),
    ]);
    return paginate(rows, count?.total ?? 0, page);
  }

  private async mustFind(id: string): Promise<BookingView> {
    const rows = await this.dataSource.query<BookingView[]>(
      `${VIEW_SQL} WHERE b.idtb_bookings = $1`,
      [id],
    );
    if (!rows[0]) throw new Error(`Booking ${id} vanished`);
    return rows[0];
  }
}
