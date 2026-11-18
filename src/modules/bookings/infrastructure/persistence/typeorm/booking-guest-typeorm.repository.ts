import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { QueryFailedError, type DataSource } from "typeorm";
import {
  GuestCodeTakenError,
  type BookingGuestRepositoryPort,
  type DayGuestFilter,
  type DayGuestsOverview,
  type GateGuest,
  type GuestFilterOption,
  type GuestInviteView,
  type GuestPeriod,
  type NewGuest,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import { ACTIVE_STATUSES } from "@/modules/bookings/domain/booking";
import type { BookingGuest } from "@/modules/bookings/domain/booking-guest";
import {
  toUnitOptions,
  type UnitRow,
} from "@/modules/condominiums/infrastructure/persistence/unit-options";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const GUEST_COLUMNS = `
  g.idtb_booking_guests AS id, g.idtb_bookings AS "bookingId",
  g.idtb_condominiums AS "condominiumId", g.name,
  g.document_type AS "documentType", g.document, g.phone,
  g.code, g.checked_in_at AS "checkedInAt", g.checked_in_by AS "checkedInBy",
  g.created_at AS "createdAt"`;

// Booking, space, host and unit come from other tables, read-only.
const GATE_SQL = `
  SELECT ${GUEST_COLUMNS},
         b.starts_at AS "startsAt", b.ends_at AS "endsAt",
         b.status AS "bookingStatus", b.idtb_users AS "bookingUserId",
         s.name AS "spaceName", u.name AS "hostName",
         un.street AS "unitStreet", un.block AS "unitBlock",
         un.number AS "unitNumber",
         c.name AS "condominiumName"
    FROM tb_booking_guests g
    JOIN tb_bookings b ON b.idtb_bookings = g.idtb_bookings
    JOIN tb_spaces s ON s.idtb_spaces = b.idtb_spaces
    JOIN tb_users u ON u.idtb_users = b.idtb_users
    JOIN tb_condominiums c ON c.idtb_condominiums = g.idtb_condominiums
    LEFT JOIN tb_units un ON un.idtb_units = b.idtb_units`;

const ACTIVE_SQL = ACTIVE_STATUSES.map((status) => `'${status}'`).join(", ");

// Guests of the condominium's ($1) active bookings that overlap [$2, $3).
const DAY_SQL = `g.idtb_condominiums = $1 AND b.status IN (${ACTIVE_SQL})
  AND b.starts_at < $3 AND b.ends_at > $2`;

const isUniqueViolation = (error: unknown) =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string } | undefined)?.code === "23505";

@Injectable()
export class BookingGuestTypeormRepository implements BookingGuestRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  listForBooking(bookingId: string): Promise<BookingGuest[]> {
    return this.dataSource.query<BookingGuest[]>(
      `SELECT ${GUEST_COLUMNS} FROM tb_booking_guests g
        WHERE g.idtb_bookings = $1
        ORDER BY g.created_at, g.name`,
      [bookingId],
    );
  }

  async countForBooking(bookingId: string): Promise<number> {
    const [row] = await this.dataSource.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM tb_booking_guests
        WHERE idtb_bookings = $1`,
      [bookingId],
    );
    return row?.count ?? 0;
  }

  async add(
    booking: { id: string; condominiumId: string },
    guests: NewGuest[],
    actorId: string,
  ): Promise<BookingGuest[]> {
    if (guests.length === 0) return [];
    // One statement: every guest is added, or none.
    const values: unknown[] = [booking.id, booking.condominiumId, actorId];
    const rows = guests.map((guest) => {
      values.push(
        guest.name,
        guest.documentType,
        guest.document,
        guest.phone,
        guest.code,
      );
      const n = values.length;
      return `($1, $2, $${n - 4}, $${n - 3}, $${n - 2}, $${n - 1}, $${n}, $3, $3)`;
    });
    try {
      return await this.dataSource.query<BookingGuest[]>(
        `INSERT INTO tb_booking_guests AS g
           (idtb_bookings, idtb_condominiums, name, document_type, document,
            phone, code, created_by, updated_by)
         VALUES ${rows.join(", ")}
         RETURNING ${GUEST_COLUMNS}`,
        values,
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new GuestCodeTakenError();
      throw error;
    }
  }

  async find(condominiumId: string, id: string): Promise<GateGuest | null> {
    const rows = await this.dataSource.query<GateGuest[]>(
      `${GATE_SQL}
        WHERE g.idtb_booking_guests = $1 AND g.idtb_condominiums = $2`,
      [id, condominiumId],
    );
    return rows[0] ?? null;
  }

  async findByCode(code: string): Promise<GuestInviteView | null> {
    const rows = await this.dataSource.query<GuestInviteView[]>(
      `${GATE_SQL} WHERE g.code = $1`,
      [code],
    );
    return rows[0] ?? null;
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM tb_booking_guests WHERE idtb_booking_guests = $1`,
      [id],
    );
  }

  forGate(condominiumId: string, from: Date, to: Date): Promise<GateGuest[]> {
    return this.dataSource.query<GateGuest[]>(
      `${GATE_SQL}
        WHERE ${DAY_SQL}
        ORDER BY b.starts_at, unaccent(g.name)`,
      [condominiumId, from, to],
    );
  }

  async forDay(
    condominiumId: string,
    period: GuestPeriod,
    filter: DayGuestFilter,
    page: PageRequest,
  ): Promise<Paginated<GateGuest>> {
    const params: unknown[] = [condominiumId, period.from, period.to];
    const where = [DAY_SQL];
    const narrow = (column: string, value: string | null) => {
      if (value === null) return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    };
    narrow("g.idtb_booking_guests", filter.guestId);
    narrow("b.idtb_users", filter.hostId);
    narrow("b.idtb_units", filter.unitId);
    narrow("b.idtb_spaces", filter.spaceId);
    if (filter.checkedIn !== null) {
      where.push(
        filter.checkedIn
          ? "g.checked_in_at IS NOT NULL"
          : "g.checked_in_at IS NULL",
      );
    }
    const clause = `WHERE ${where.join(" AND ")}`;
    const [rows, [count]] = await Promise.all([
      this.dataSource.query<GateGuest[]>(
        `${GATE_SQL} ${clause}
          ORDER BY b.starts_at, unaccent(s.name), b.idtb_bookings,
                   unaccent(g.name)
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total
           FROM tb_booking_guests g
           JOIN tb_bookings b ON b.idtb_bookings = g.idtb_bookings
          ${clause}`,
        params,
      ),
    ]);
    return paginate(rows, count?.total ?? 0, page);
  }

  async overviewOfDay(
    condominiumId: string,
    period: GuestPeriod,
  ): Promise<DayGuestsOverview> {
    const params = [condominiumId, period.from, period.to];
    const day = `FROM tb_booking_guests g
      JOIN tb_bookings b ON b.idtb_bookings = g.idtb_bookings
     WHERE ${DAY_SQL}`;
    const [[totals], guests, hosts, units, spaces] = await Promise.all([
      this.dataSource.query<
        { total: number; checkedIn: number; bookings: number }[]
      >(
        `SELECT count(*)::int AS total,
                count(g.checked_in_at)::int AS "checkedIn",
                count(DISTINCT b.idtb_bookings)::int AS bookings
           ${day}`,
        params,
      ),
      this.dataSource.query<GuestFilterOption[]>(
        `SELECT g.idtb_booking_guests AS id, g.name AS label
           ${day}
          ORDER BY unaccent(g.name)`,
        params,
      ),
      this.dataSource.query<GuestFilterOption[]>(
        `SELECT DISTINCT u.idtb_users AS id, u.name AS label,
                unaccent(u.name) AS sort
           ${day.replace("WHERE", "JOIN tb_users u ON u.idtb_users = b.idtb_users WHERE")}
          ORDER BY sort`,
        params,
      ),
      this.dataSource.query<UnitRow[]>(
        `SELECT DISTINCT un.idtb_units AS id, un.street, un.block, un.number
           ${day.replace("WHERE", "JOIN tb_units un ON un.idtb_units = b.idtb_units WHERE")}`,
        params,
      ),
      this.dataSource.query<GuestFilterOption[]>(
        `SELECT DISTINCT s.idtb_spaces AS id, s.name AS label,
                unaccent(s.name) AS sort
           ${day.replace("WHERE", "JOIN tb_spaces s ON s.idtb_spaces = b.idtb_spaces WHERE")}
          ORDER BY sort`,
        params,
      ),
    ]);
    const option = ({ id, label }: GuestFilterOption) => ({ id, label });
    return {
      total: totals?.total ?? 0,
      checkedIn: totals?.checkedIn ?? 0,
      bookings: totals?.bookings ?? 0,
      guests,
      hosts: hosts.map(option),
      units: toUnitOptions(units).map(({ id, label }) => ({ id, label })),
      spaces: spaces.map(option),
    };
  }

  async setCheckIn(
    id: string,
    at: Date | null,
    actorId: string,
  ): Promise<void> {
    await this.dataSource.query(
      `UPDATE tb_booking_guests
          SET checked_in_at = $2::timestamptz,
              checked_in_by = CASE WHEN $2::timestamptz IS NULL THEN NULL ELSE $3::uuid END,
              updated_at = now(), updated_by = $3::uuid
        WHERE idtb_booking_guests = $1`,
      [id, at, actorId],
    );
  }
}
