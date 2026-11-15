import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type {
  RankingTotals,
  SupporterRepositoryPort,
  SupporterWithContributions,
} from "@/modules/supporters/application/ports/supporter-repository.port";
import type {
  ContributionData,
  RankingRow,
  SupportContribution,
  Supporter,
} from "@/modules/supporters/domain/supporter";

type SupporterRow = {
  id: string;
  name: string;
  showName: boolean;
  totalCents: string | number;
  contributions: string | number;
  lastReceivedOn: string | null;
  createdAt: Date;
};

type ContributionRow = {
  id: string;
  supporterId: string;
  amountCents: number;
  receivedOn: string;
  note: string | null;
  createdAt: Date;
};

const SUPPORTER_COLUMNS = `
  s.idtb_supporters AS id,
  s.name,
  s.show_name AS "showName",
  COALESCE(SUM(c.amount_cents), 0) AS "totalCents",
  COUNT(c.idtb_support_contributions) AS contributions,
  to_char(MAX(c.received_on), 'YYYY-MM-DD') AS "lastReceivedOn",
  s.created_at AS "createdAt"`;

const CONTRIBUTION_COLUMNS = `
  idtb_support_contributions AS id,
  idtb_supporters AS "supporterId",
  amount_cents AS "amountCents",
  to_char(received_on, 'YYYY-MM-DD') AS "receivedOn",
  note,
  created_at AS "createdAt"`;

// Both tables are plain records: raw SQL, sums done by the database.
@Injectable()
export class SupporterTypeormRepository implements SupporterRepositoryPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async record(
    data: ContributionData,
    createdBy: string,
  ): Promise<SupportContribution> {
    return this.dataSource.transaction(async (manager) => {
      const [supporter] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_supporters (name, show_name)
         VALUES ($1, $2)
         ON CONFLICT (lower(name))
           DO UPDATE SET show_name = EXCLUDED.show_name, updated_at = now()
         RETURNING idtb_supporters AS id`,
        [data.name, data.showName],
      );
      const [row] = await manager.query<ContributionRow[]>(
        `INSERT INTO tb_support_contributions
           (idtb_supporters, amount_cents, received_on, note, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${CONTRIBUTION_COLUMNS}`,
        [supporter.id, data.amountCents, data.receivedOn, data.note, createdBy],
      );
      return row;
    });
  }

  async listWithHistory(): Promise<SupporterWithContributions[]> {
    const supporters = await this.dataSource.query<SupporterRow[]>(
      `SELECT ${SUPPORTER_COLUMNS}
         FROM tb_supporters s
         LEFT JOIN tb_support_contributions c
           ON c.idtb_supporters = s.idtb_supporters
        GROUP BY s.idtb_supporters
        ORDER BY "totalCents" DESC, s.name`,
    );
    const history = await this.dataSource.query<ContributionRow[]>(
      `SELECT ${CONTRIBUTION_COLUMNS}
         FROM tb_support_contributions
        ORDER BY received_on DESC, created_at DESC`,
    );
    const bySupporter = new Map<string, SupportContribution[]>();
    for (const row of history) {
      const list = bySupporter.get(row.supporterId) ?? [];
      list.push(row);
      bySupporter.set(row.supporterId, list);
    }
    return supporters.map((row) => ({
      ...toSupporter(row),
      history: bySupporter.get(row.id) ?? [],
    }));
  }

  async findById(id: string): Promise<Supporter | null> {
    const [row] = await this.dataSource.query<SupporterRow[]>(
      `SELECT ${SUPPORTER_COLUMNS}
         FROM tb_supporters s
         LEFT JOIN tb_support_contributions c
           ON c.idtb_supporters = s.idtb_supporters
        WHERE s.idtb_supporters = $1
        GROUP BY s.idtb_supporters`,
      [id],
    );
    return row ? toSupporter(row) : null;
  }

  async update(id: string, name: string, showName: boolean): Promise<boolean> {
    const [taken] = await this.dataSource.query<unknown[]>(
      `SELECT 1 FROM tb_supporters
        WHERE lower(name) = lower($1) AND idtb_supporters <> $2`,
      [name, id],
    );
    if (taken) return false;
    await this.dataSource.query(
      `UPDATE tb_supporters
          SET name = $2, show_name = $3, updated_at = now()
        WHERE idtb_supporters = $1`,
      [id, name, showName],
    );
    return true;
  }

  async delete(id: string): Promise<boolean> {
    // node-postgres returns [rows, affected] for DELETE … RETURNING.
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `DELETE FROM tb_supporters WHERE idtb_supporters = $1 RETURNING 1`,
      [id],
    );
    return affected > 0;
  }

  async deleteContribution(id: string): Promise<boolean> {
    const [, affected] = await this.dataSource.query<[unknown, number]>(
      `DELETE FROM tb_support_contributions
        WHERE idtb_support_contributions = $1 RETURNING 1`,
      [id],
    );
    return affected > 0;
  }

  async rankingRows(year: number | null): Promise<RankingRow[]> {
    const rows = await this.dataSource.query<
      (Omit<RankingRow, "totalCents" | "contributions"> & {
        totalCents: string | number;
        contributions: string | number;
      })[]
    >(
      `SELECT s.idtb_supporters AS "supporterId",
              s.name,
              s.show_name AS "showName",
              SUM(c.amount_cents) AS "totalCents",
              COUNT(*) AS contributions,
              to_char(MIN(c.received_on), 'YYYY-MM-DD') AS "firstReceivedOn"
         FROM tb_supporters s
         JOIN tb_support_contributions c
           ON c.idtb_supporters = s.idtb_supporters
        WHERE $1::int IS NULL
           OR EXTRACT(YEAR FROM c.received_on) = $1::int
        GROUP BY s.idtb_supporters`,
      [year],
    );
    return rows.map((row) => ({
      ...row,
      totalCents: Number(row.totalCents),
      contributions: Number(row.contributions),
    }));
  }

  async totals(year: number | null): Promise<RankingTotals> {
    const [row] = await this.dataSource.query<
      { supporters: string; totalCents: string | null }[]
    >(
      `SELECT COUNT(DISTINCT idtb_supporters) AS supporters,
              SUM(amount_cents) AS "totalCents"
         FROM tb_support_contributions
        WHERE $1::int IS NULL
           OR EXTRACT(YEAR FROM received_on) = $1::int`,
      [year],
    );
    return {
      supporters: Number(row?.supporters ?? 0),
      totalCents: Number(row?.totalCents ?? 0),
    };
  }
}

function toSupporter(row: SupporterRow): Supporter {
  return {
    id: row.id,
    name: row.name,
    showName: row.showName,
    totalCents: Number(row.totalCents),
    contributions: Number(row.contributions),
    lastReceivedOn: row.lastReceivedOn,
    createdAt: row.createdAt,
  };
}
