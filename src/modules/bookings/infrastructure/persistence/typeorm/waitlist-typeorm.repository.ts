import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  WaitlistEntry,
  WaitlistRepositoryPort,
} from "@/modules/bookings/application/ports/waitlist-repository.port";

// The waiting list is a plain table (no entity logic): rows come and go.
@Injectable()
export class WaitlistTypeormRepository implements WaitlistRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async join(entry: WaitlistEntry): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO tb_booking_waitlist
         (idtb_condominiums, idtb_spaces, idtb_users, starts_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ON CONSTRAINT uq_booking_waitlist DO NOTHING`,
      [entry.condominiumId, entry.spaceId, entry.userId, entry.startsAt],
    );
  }

  async leave(spaceId: string, startsAt: Date, userId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM tb_booking_waitlist
        WHERE idtb_spaces = $1 AND starts_at = $2 AND idtb_users = $3`,
      [spaceId, startsAt, userId],
    );
  }

  async waiting(spaceId: string, startsAt: Date): Promise<string[]> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT idtb_users AS id FROM tb_booking_waitlist
        WHERE idtb_spaces = $1 AND starts_at = $2
        ORDER BY created_at`,
      [spaceId, startsAt],
    );
    return rows.map((row) => row.id);
  }

  async startsFor(
    spaceId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Date[]> {
    const rows = await this.dataSource.query<{ startsAt: Date }[]>(
      `SELECT starts_at AS "startsAt" FROM tb_booking_waitlist
        WHERE idtb_spaces = $1 AND idtb_users = $2
          AND starts_at >= $3 AND starts_at < $4`,
      [spaceId, userId, from, to],
    );
    return rows.map((row) => new Date(row.startsAt));
  }

  async purgeStartedBefore(before: Date): Promise<number> {
    // node-postgres returns [rows, affected] for DELETE … RETURNING.
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `DELETE FROM tb_booking_waitlist WHERE starts_at < $1 RETURNING 1`,
      [before],
    );
    return affected;
  }
}
