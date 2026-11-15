import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { QueryFailedError, type DataSource } from "typeorm";
import {
  GuestCodeTakenError,
  type BookingGuestRepositoryPort,
  type GateGuest,
  type GuestInviteView,
  type NewGuest,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import { ACTIVE_STATUSES } from "@/modules/bookings/domain/booking";
import type { BookingGuest } from "@/modules/bookings/domain/booking-guest";

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
        WHERE g.idtb_condominiums = $1 AND b.status IN (${ACTIVE_SQL})
          AND b.starts_at < $3 AND b.ends_at > $2
        ORDER BY b.starts_at, unaccent(g.name)`,
      [condominiumId, from, to],
    );
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
