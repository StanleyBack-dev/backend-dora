import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import type { DataSource, Repository } from "typeorm";
import type {
  CondominiumData,
  CondominiumFilter,
  CondominiumRepositoryPort,
  CondominiumSummary,
} from "@/modules/condominiums/application/ports/condominium-repository.port";
import type {
  Condominium,
  CondominiumStatus,
} from "@/modules/condominiums/domain/condominium";
import { CondominiumOrmEntity } from "@/modules/condominiums/infrastructure/persistence/typeorm/condominium.orm-entity";

const toCondominium = (row: CondominiumOrmEntity): Condominium => ({
  id: row.id,
  name: row.name,
  document: row.document,
  city: row.city,
  state: row.state,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

// The counts read the membership, account and sign-up tables (identity,
// enrollment) read-only, in one statement: the console lists every tenant.
const SUMMARY_SQL = `
  SELECT c.idtb_condominiums AS id, c.name, c.document, c.city, c.state,
         c.status, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
         (SELECT count(*)::int FROM tb_memberships m
            JOIN tb_users u ON u.idtb_users = m.idtb_users
           WHERE m.idtb_condominiums = c.idtb_condominiums
             AND m.active AND u.active) AS "activeMembers",
         (SELECT count(*)::int FROM tb_memberships m
            JOIN tb_users u ON u.idtb_users = m.idtb_users
           WHERE m.idtb_condominiums = c.idtb_condominiums
             AND m.active AND u.active AND m.role = 'ADMIN') AS "managers",
         (SELECT count(*)::int FROM tb_units un
           WHERE un.idtb_condominiums = c.idtb_condominiums) AS "units",
         (SELECT count(*)::int FROM tb_enrollment_requests r
           WHERE r.idtb_condominiums = c.idtb_condominiums
             AND r.status = 'PENDENTE') AS "pendingEnrollments",
         (SELECT max(u.last_login_at) FROM tb_memberships m
            JOIN tb_users u ON u.idtb_users = m.idtb_users
           WHERE m.idtb_condominiums = c.idtb_condominiums) AS "lastActivityAt"
    FROM tb_condominiums c`;

@Injectable()
export class CondominiumTypeormRepository implements CondominiumRepositoryPort {
  constructor(
    @InjectRepository(CondominiumOrmEntity)
    private readonly repository: Repository<CondominiumOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  list(filter: CondominiumFilter): Promise<CondominiumSummary[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const search = filter.search?.trim();
    if (search) {
      params.push(`%${escapeLike(search)}%`);
      where.push(
        `(unaccent(c.name) ILIKE unaccent($${params.length})
          OR unaccent(c.city) ILIKE unaccent($${params.length}))`,
      );
    }
    if (filter.status) {
      params.push(filter.status);
      where.push(`c.status = $${params.length}`);
    }
    return this.dataSource.query<CondominiumSummary[]>(
      `${SUMMARY_SQL}
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY c.status, unaccent(c.name)`,
      params,
    );
  }

  async findSummary(id: string): Promise<CondominiumSummary | null> {
    const rows = await this.dataSource.query<CondominiumSummary[]>(
      `${SUMMARY_SQL} WHERE c.idtb_condominiums = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<Condominium | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toCondominium(row) : null;
  }

  async findByDocument(document: string): Promise<Condominium | null> {
    const row = await this.repository.findOne({ where: { document } });
    return row ? toCondominium(row) : null;
  }

  async create(data: CondominiumData): Promise<Condominium> {
    const row = await this.repository.save(this.repository.create(data));
    return toCondominium(row);
  }

  async update(
    id: string,
    patch: Partial<CondominiumData> & { status?: CondominiumStatus },
  ): Promise<Condominium> {
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }
    return toCondominium(
      await this.repository.findOneOrFail({ where: { id } }),
    );
  }
}
