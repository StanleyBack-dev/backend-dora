import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { In, type DataSource, type Repository } from "typeorm";
import type {
  UnitFilter,
  UnitPlace,
  UnitRepositoryPort,
  UnitResident,
  UnitView,
  UnitWithResidents,
} from "@/modules/condominiums/application/ports/unit-repository.port";
import { UnitOccupancy, type Unit } from "@/modules/condominiums/domain/unit";
import { UnitOrmEntity } from "@/modules/condominiums/infrastructure/persistence/typeorm/unit.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

/** An active member linked to the unit `un` (the occupancy filter). */
const ACTIVE_RESIDENT = `SELECT 1 FROM tb_residents r
   JOIN tb_memberships m ON m.idtb_memberships = r.idtb_memberships
  WHERE r.idtb_units = un.idtb_units AND m.active`;

const toUnit = (row: UnitOrmEntity): Unit => ({
  id: row.id,
  condominiumId: row.condominiumId,
  street: row.street,
  block: row.block,
  number: row.number,
});

// "2" before "10": by street (houses), block, then by the number's digits,
// then as text.
const UNIT_ORDER = String.raw`lower(un.street), lower(un.block),
  NULLIF(regexp_replace(un.number, '\D', '', 'g'), '')::numeric NULLS LAST,
  lower(un.number)`;

@Injectable()
export class UnitTypeormRepository implements UnitRepositoryPort {
  constructor(
    @InjectRepository(UnitOrmEntity)
    private readonly repository: Repository<UnitOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  list(condominiumId: string): Promise<UnitView[]> {
    return this.query("un.idtb_condominiums = $1", [condominiumId]);
  }

  async findById(condominiumId: string, id: string): Promise<UnitView | null> {
    const rows = await this.query(
      "un.idtb_condominiums = $1 AND un.idtb_units = $2",
      [condominiumId, id],
    );
    return rows[0] ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<Unit[]> {
    if (ids.length === 0) return [];
    const rows = await this.repository.find({ where: { id: In([...ids]) } });
    return rows.map(toUnit);
  }

  createMany(
    condominiumId: string,
    units: readonly UnitPlace[],
  ): Promise<Unit[]> {
    if (units.length === 0) return Promise.resolve([]);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(UnitOrmEntity);
      const rows = await repository.save(
        units.map((unit) => repository.create({ ...unit, condominiumId })),
        { chunk: 100 },
      );
      return rows.map(toUnit);
    });
  }

  async update(id: string, patch: UnitPlace): Promise<void> {
    await this.repository.update({ id }, patch);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  async page(
    condominiumId: string,
    filter: UnitFilter,
    page: PageRequest,
  ): Promise<Paginated<UnitWithResidents>> {
    const params: unknown[] = [condominiumId];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where = ["un.idtb_condominiums = $1"];
    if (filter.unitId) where.push(`un.idtb_units = ${param(filter.unitId)}`);
    if (filter.block !== undefined) {
      where.push(`lower(un.block) = lower(${param(filter.block)})`);
    }
    if (filter.street !== undefined) {
      where.push(`lower(un.street) = lower(${param(filter.street)})`);
    }
    if (filter.occupancy) {
      where.push(
        `${filter.occupancy === UnitOccupancy.EMPTY ? "NOT " : ""}EXISTS (${ACTIVE_RESIDENT})`,
      );
    }
    const clause = where.join(" AND ");

    const [units, [{ total }]] = await Promise.all([
      this.query(
        clause,
        params,
        `LIMIT ${Number(page.limit)} OFFSET ${(page.page - 1) * page.limit}`,
      ),
      this.dataSource.query<{ total: number }[]>(
        `SELECT count(*)::int AS total FROM tb_units un WHERE ${clause}`,
        params,
      ),
    ]);
    const people = await this.peopleOf(units.map((unit) => unit.id));
    return paginate(
      units.map((unit) => ({ ...unit, people: people.get(unit.id) ?? [] })),
      total,
      page,
    );
  }

  // Everyone linked to these units (active first, then by name), from
  // tb_residents / tb_memberships / tb_users (identity), read-only.
  private async peopleOf(
    unitIds: readonly string[],
  ): Promise<Map<string, UnitResident[]>> {
    const byUnit = new Map<string, UnitResident[]>();
    if (unitIds.length === 0) return byUnit;
    const rows = await this.dataSource.query<
      (UnitResident & { unitId: string })[]
    >(
      `SELECT r.idtb_units AS "unitId", u.idtb_users AS "userId", u.name,
              m.role, u.email, u.phone, (m.active AND u.active) AS active
         FROM tb_residents r
         JOIN tb_memberships m ON m.idtb_memberships = r.idtb_memberships
         JOIN tb_users u ON u.idtb_users = m.idtb_users
        WHERE r.idtb_units = ANY($1::uuid[])
        ORDER BY (m.active AND u.active) DESC, lower(u.name)`,
      [[...unitIds]],
    );
    for (const { unitId, ...person } of rows) {
      byUnit.set(unitId, [...(byUnit.get(unitId) ?? []), person]);
    }
    return byUnit;
  }

  // Residents come from tb_residents / tb_memberships (identity), read-only.
  private query(
    where: string,
    params: unknown[],
    suffix = "",
  ): Promise<UnitView[]> {
    return this.dataSource.query<UnitView[]>(
      `SELECT un.idtb_units AS id, un.idtb_condominiums AS "condominiumId",
              un.street, un.block, un.number,
              (SELECT count(*)::int FROM tb_residents r
                 JOIN tb_memberships m
                   ON m.idtb_memberships = r.idtb_memberships
                WHERE r.idtb_units = un.idtb_units AND m.active) AS residents
         FROM tb_units un
        WHERE ${where}
        ORDER BY ${UNIT_ORDER}
        ${suffix}`,
      params,
    );
  }
}
