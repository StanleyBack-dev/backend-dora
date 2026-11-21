import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import type {
  LostReport,
  LostReportRepositoryPort,
  NewLostReport,
} from "@/modules/lost-and-found/application/ports/lost-report-repository.port";
import type { FoundItemCategory } from "@/modules/lost-and-found/domain/found-item";
import { LostReportStatus } from "@/modules/lost-and-found/domain/lost-report";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const OPEN = LostReportStatus.OPEN;

// The resident's name and unit come from identity and condominiums,
// read-only.
const SELECT = `
  SELECT l.idtb_lost_reports AS id, l.idtb_condominiums AS "condominiumId",
         l.idtb_users AS "userId", u.name AS "userName",
         un.idtb_units AS "unitId", un.street AS "unitStreet", un.block AS "unitBlock",
         un.number AS "unitNumber",
         l.category, l.title, l.description,
         l.lost_location AS "lostLocation",
         to_char(l.lost_on, 'YYYY-MM-DD') AS "lostOn",
         l.photo_key AS "photoKey", l.shared,
         (SELECT count(*)::int FROM tb_lost_report_spots s
           WHERE s.idtb_lost_reports = l.idtb_lost_reports) AS "spotCount",
         l.status, l.idtb_found_items AS "foundItemId",
         l.closed_at AS "closedAt", l.created_at AS "createdAt"
    FROM tb_lost_reports l
    JOIN tb_users u ON u.idtb_users = l.idtb_users
    LEFT JOIN tb_memberships m
      ON m.idtb_users = l.idtb_users
     AND m.idtb_condominiums = l.idtb_condominiums
    LEFT JOIN tb_residents res ON res.idtb_memberships = m.idtb_memberships
    LEFT JOIN tb_units un ON un.idtb_units = res.idtb_units`;

type Row = Omit<LostReport, "unitLabel"> & {
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
};

const toReport = (row: Row): LostReport => {
  const { unitStreet, unitBlock, unitNumber, ...report } = row;
  return {
    ...report,
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

@Injectable()
export class LostReportSqlRepository implements LostReportRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  private async select(sql: string, params: unknown[]): Promise<LostReport[]> {
    const rows = await this.dataSource.query<Row[]>(sql, params);
    return rows.map(toReport);
  }

  private async page(
    clause: string,
    order: string,
    params: unknown[],
    page: PageRequest,
  ): Promise<Paginated<LostReport>> {
    const [items, [count]] = await Promise.all([
      this.select(
        `${SELECT} ${clause} ORDER BY ${order}
          LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
        params,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_lost_reports l ${clause}`,
        params,
      ),
    ]);
    return paginate(items, count?.total ?? 0, page);
  }

  async create(report: NewLostReport): Promise<LostReport> {
    const [inserted] = await this.dataSource.query<{ id: string }[]>(
      `INSERT INTO tb_lost_reports
         (idtb_condominiums, idtb_users, category, title, description,
          lost_location, lost_on, photo_key, shared)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING idtb_lost_reports AS id`,
      [
        report.condominiumId,
        report.userId,
        report.category,
        report.title,
        report.description,
        report.lostLocation,
        report.lostOn,
        report.photoKey,
        report.shared,
      ],
    );
    const [created] = await this.select(
      `${SELECT} WHERE l.idtb_lost_reports = $1`,
      [inserted.id],
    );
    return created;
  }

  async find(condominiumId: string, id: string): Promise<LostReport | null> {
    const [report] = await this.select(
      `${SELECT} WHERE l.idtb_condominiums = $1 AND l.idtb_lost_reports = $2`,
      [condominiumId, id],
    );
    return report ?? null;
  }

  mine(
    condominiumId: string,
    userId: string,
    page: PageRequest,
  ): Promise<Paginated<LostReport>> {
    return this.page(
      `WHERE l.idtb_condominiums = $1 AND l.idtb_users = $2`,
      `(l.status = '${OPEN}') DESC, l.created_at DESC`,
      [condominiumId, userId],
      page,
    );
  }

  list(
    condominiumId: string,
    open: boolean,
    page: PageRequest,
  ): Promise<Paginated<LostReport>> {
    return this.page(
      `WHERE l.idtb_condominiums = $1 AND l.status ${open ? "=" : "<>"} '${OPEN}'`,
      open ? "l.created_at DESC" : "l.closed_at DESC",
      [condominiumId],
      page,
    );
  }

  async board(
    condominiumId: string,
    viewerId: string,
    page: PageRequest,
  ): Promise<Paginated<LostReport & { spottedByMe: boolean }>> {
    const found = await this.page(
      `WHERE l.idtb_condominiums = $1 AND l.status = '${OPEN}' AND l.shared`,
      "l.created_at DESC",
      [condominiumId],
      page,
    );
    const ids = found.items.map((report) => report.id);
    const mine =
      ids.length === 0
        ? []
        : await this.dataSource.query<{ id: string }[]>(
            `SELECT idtb_lost_reports AS id FROM tb_lost_report_spots
              WHERE idtb_users = $1 AND idtb_lost_reports = ANY($2::uuid[])`,
            [viewerId, ids],
          );
    const spotted = new Set(mine.map((row) => row.id));
    return {
      ...found,
      items: found.items.map((report) => ({
        ...report,
        spottedByMe: spotted.has(report.id),
      })),
    };
  }

  spot(
    reportId: string,
    userId: string,
    note: string | null,
    notices: OutboxDraft[],
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_lost_report_spots (idtb_lost_reports, idtb_users, note)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING
         RETURNING idtb_lost_reports AS id`,
        [reportId, userId, note],
      );
      if (inserted.length === 0) return false;
      await this.outbox.write(manager, notices);
      return true;
    });
  }

  async notify(notices: OutboxDraft[]): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.outbox.write(manager, notices),
    );
  }

  openOf(
    condominiumId: string,
    category: FoundItemCategory,
  ): Promise<LostReport[]> {
    return this.select(
      `${SELECT} WHERE l.idtb_condominiums = $1 AND l.category = $2
                   AND l.status = '${OPEN}'
        ORDER BY l.created_at`,
      [condominiumId, category],
    );
  }

  async close(
    id: string,
    userId: string,
    status: LostReportStatus.FOUND | LostReportStatus.CANCELLED,
    at: Date,
  ): Promise<LostReport | null> {
    const [updated] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE tb_lost_reports SET status = $3, closed_at = $4
        WHERE idtb_lost_reports = $1 AND idtb_users = $2
          AND status = '${OPEN}'
        RETURNING idtb_lost_reports AS id`,
      [id, userId, status, at],
    );
    if (updated.length === 0) return null;
    const [report] = await this.select(
      `${SELECT} WHERE l.idtb_lost_reports = $1`,
      [id],
    );
    return report ?? null;
  }

  async closeFoundBy(
    userId: string,
    itemId: string,
    category: FoundItemCategory,
    at: Date,
  ): Promise<number> {
    const [rows] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE tb_lost_reports l
          SET status = '${LostReportStatus.FOUND}', closed_at = $4,
              idtb_found_items = $2
         FROM tb_found_items f
        WHERE f.idtb_found_items = $2
          AND l.idtb_condominiums = f.idtb_condominiums
          AND l.idtb_users = $1 AND l.category = $3
          AND l.status = '${OPEN}'
        RETURNING l.idtb_lost_reports AS id`,
      [userId, itemId, category, at],
    );
    return rows.length;
  }

  async releasePhotos(closedBefore: Date): Promise<string[]> {
    const [rows] = await this.dataSource.query<[{ key: string }[], number]>(
      `UPDATE tb_lost_reports l SET photo_key = NULL
         FROM (SELECT idtb_lost_reports, photo_key FROM tb_lost_reports
                WHERE photo_key IS NOT NULL AND closed_at < $1
                FOR UPDATE) old
        WHERE l.idtb_lost_reports = old.idtb_lost_reports
        RETURNING old.photo_key AS key`,
      [closedBefore],
    );
    return rows.map((row) => row.key);
  }

  async reopenLinkedTo(itemId: string): Promise<number> {
    const [rows] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE tb_lost_reports
          SET status = '${OPEN}', closed_at = NULL, idtb_found_items = NULL
        WHERE idtb_found_items = $1
          AND status = '${LostReportStatus.FOUND}'
        RETURNING idtb_lost_reports AS id`,
      [itemId],
    );
    return rows.length;
  }

  async expire(before: Date, at: Date): Promise<LostReport[]> {
    const [rows] = await this.dataSource.query<[{ id: string }[], number]>(
      `UPDATE tb_lost_reports
          SET status = '${LostReportStatus.EXPIRED}', closed_at = $2
        WHERE status = '${OPEN}' AND created_at < $1
        RETURNING idtb_lost_reports AS id`,
      [before, at],
    );
    if (rows.length === 0) return [];
    return this.select(
      `${SELECT} WHERE l.idtb_lost_reports = ANY($1::uuid[])`,
      [rows.map((row) => row.id)],
    );
  }

  async countOpen(condominiumId: string): Promise<number> {
    const [row] = await this.dataSource.query<{ total: number }[]>(
      `SELECT count(*)::int AS total FROM tb_lost_reports
        WHERE idtb_condominiums = $1 AND status = '${OPEN}'`,
      [condominiumId],
    );
    return row?.total ?? 0;
  }
}
