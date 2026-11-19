import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { QueryFailedError, type DataSource } from "typeorm";
import {
  NO_FEE_FILTER,
  SlotTakenError,
  type BookingFilter,
  type BookingPatch,
  type BookingRepositoryPort,
  type BookingView,
  type FeeFilter,
  type FeeFilterOption,
  type FeesOverview,
  type NewBooking,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  toUnitOptions,
  type UnitRow,
} from "@/modules/condominiums/infrastructure/persistence/unit-options";
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
  feeCents: row.feeCents,
  feeBilledAt: row.feeBilledAt,
  seriesId: row.seriesId,
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
         b.fee_cents AS "feeCents", b.fee_billed_at AS "feeBilledAt",
         b.series_id AS "seriesId", b.created_at AS "createdAt",
         s.name AS "spaceName", s.kind AS "spaceKind",
         s.guests_allowed AS "guestsAllowed", u.name AS "userName",
         un.street AS "unitStreet", un.block AS "unitBlock",
         un.number AS "unitNumber"
    FROM tb_bookings b
    JOIN tb_spaces s ON s.idtb_spaces = b.idtb_spaces
    JOIN tb_users u ON u.idtb_users = b.idtb_users
    LEFT JOIN tb_units un ON un.idtb_units = b.idtb_units`;

const ACTIVE_SQL = ACTIVE_STATUSES.map((status) => `'${status}'`).join(", ");

// The usage fees: confirmed bookings with a fee starting in [from, to), by
// unit and then start.
const FEES_ORDER = "ORDER BY un.block NULLS FIRST, un.number, b.starts_at";

// Uses only `b` (tb_bookings), so the count and the overview reuse it.
function feesWhere(
  condominiumId: string,
  from: Date,
  to: Date,
  filter: FeeFilter,
) {
  const params: unknown[] = [condominiumId, from, to];
  const where = [
    "b.idtb_condominiums = $1",
    "b.status = 'CONFIRMED'",
    "b.fee_cents IS NOT NULL",
    "b.starts_at >= $2",
    "b.starts_at < $3",
  ];
  const narrow = (column: string, value: string | null) => {
    if (value === null) return;
    params.push(value);
    where.push(`${column} = $${params.length}`);
  };
  narrow("b.idtb_units", filter.unitId);
  narrow("b.idtb_spaces", filter.spaceId);
  narrow("b.idtb_users", filter.userId);
  if (filter.billed !== null) {
    where.push(
      filter.billed ? "b.fee_billed_at IS NOT NULL" : "b.fee_billed_at IS NULL",
    );
  }
  return { clause: `WHERE ${where.join(" AND ")}`, params };
}

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

  feesInRange(
    condominiumId: string,
    from: Date,
    to: Date,
    filter: FeeFilter = NO_FEE_FILTER,
  ): Promise<BookingView[]> {
    const { clause, params } = feesWhere(condominiumId, from, to, filter);
    return this.dataSource.query<BookingView[]>(
      `${VIEW_SQL} ${clause} ${FEES_ORDER}`,
      params,
    );
  }

  async feesPageInRange(
    condominiumId: string,
    from: Date,
    to: Date,
    filter: FeeFilter,
    page: PageRequest,
  ): Promise<Paginated<BookingView>> {
    const { clause, params } = feesWhere(condominiumId, from, to, filter);
    const [rows, [count]] = await Promise.all([
      this.dataSource.query<BookingView[]>(
        `${VIEW_SQL} ${clause} ${FEES_ORDER}
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

  async feesOverviewInRange(
    condominiumId: string,
    from: Date,
    to: Date,
  ): Promise<FeesOverview> {
    const { clause, params } = feesWhere(
      condominiumId,
      from,
      to,
      NO_FEE_FILTER,
    );
    const joined = (join: string) => `FROM tb_bookings b ${join} ${clause}`;
    const [[totals], units, spaces, users] = await Promise.all([
      this.dataSource.query<
        { count: number; totalCents: number; billedCents: number }[]
      >(
        `SELECT count(*)::int AS count,
                coalesce(sum(b.fee_cents), 0)::int AS "totalCents",
                coalesce(sum(b.fee_cents) FILTER
                  (WHERE b.fee_billed_at IS NOT NULL), 0)::int AS "billedCents"
           FROM tb_bookings b ${clause}`,
        params,
      ),
      this.dataSource.query<UnitRow[]>(
        `SELECT DISTINCT un.idtb_units AS id, un.street, un.block, un.number
           ${joined("JOIN tb_units un ON un.idtb_units = b.idtb_units")}`,
        params,
      ),
      this.dataSource.query<(FeeFilterOption & { sort: string })[]>(
        `SELECT DISTINCT s.idtb_spaces AS id, s.name AS label,
                unaccent(s.name) AS sort
           ${joined("JOIN tb_spaces s ON s.idtb_spaces = b.idtb_spaces")}
          ORDER BY sort`,
        params,
      ),
      this.dataSource.query<(FeeFilterOption & { sort: string })[]>(
        `SELECT DISTINCT u.idtb_users AS id, u.name AS label,
                unaccent(u.name) AS sort
           ${joined("JOIN tb_users u ON u.idtb_users = b.idtb_users")}
          ORDER BY sort`,
        params,
      ),
    ]);
    const option = ({ id, label }: FeeFilterOption) => ({ id, label });
    return {
      count: totals?.count ?? 0,
      totalCents: totals?.totalCents ?? 0,
      billedCents: totals?.billedCents ?? 0,
      units: toUnitOptions(units),
      spaces: spaces.map(option),
      users: users.map(option),
    };
  }

  async setFeesBilled(
    condominiumId: string,
    ids: readonly string[],
    at: Date | null,
    actorId: string,
  ): Promise<number> {
    if (ids.length === 0) return 0;
    // Only fees in the other state change: marking a fee that is already
    // billed keeps when and by whom it was billed, and the count is what
    // really changed.
    // node-postgres returns [rows, affected] for UPDATE … RETURNING.
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `UPDATE tb_bookings
          SET fee_billed_at = $3::timestamptz,
              fee_billed_by = CASE WHEN $3::timestamptz IS NULL THEN NULL ELSE $4::uuid END,
              updated_at = now(), updated_by = $4::uuid
        WHERE idtb_condominiums = $1 AND idtb_bookings = ANY($2::uuid[])
          AND status = 'CONFIRMED' AND fee_cents IS NOT NULL
          AND CASE WHEN $3::timestamptz IS NULL
                   THEN fee_billed_at IS NOT NULL
                   ELSE fee_billed_at IS NULL END
        RETURNING 1`,
      [condominiumId, [...ids], at, actorId],
    );
    return affected;
  }

  activeInSeries(
    condominiumId: string,
    seriesId: string,
    now: Date,
  ): Promise<BookingView[]> {
    return this.dataSource.query<BookingView[]>(
      `${VIEW_SQL}
        WHERE b.idtb_condominiums = $1 AND b.series_id = $2
          AND b.status IN (${ACTIVE_SQL}) AND b.ends_at > $3
        ORDER BY b.starts_at`,
      [condominiumId, seriesId, now],
    );
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
