import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { In, type DataSource, type Repository } from "typeorm";
import type {
  UnitPlace,
  UnitRepositoryPort,
  UnitView,
} from "@/modules/condominiums/application/ports/unit-repository.port";
import type { Unit } from "@/modules/condominiums/domain/unit";
import { UnitOrmEntity } from "@/modules/condominiums/infrastructure/persistence/typeorm/unit.orm-entity";

const toUnit = (row: UnitOrmEntity): Unit => ({
  id: row.id,
  condominiumId: row.condominiumId,
  block: row.block,
  number: row.number,
});

// "2" before "10": by block, then by the number's digits, then as text.
const UNIT_ORDER = String.raw`lower(un.block),
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

  // Residents come from tb_memberships (identity), read-only.
  private query(where: string, params: unknown[]): Promise<UnitView[]> {
    return this.dataSource.query<UnitView[]>(
      `SELECT un.idtb_units AS id, un.idtb_condominiums AS "condominiumId",
              un.block, un.number,
              (SELECT count(*)::int FROM tb_memberships m
                WHERE m.idtb_units = un.idtb_units AND m.active) AS residents
         FROM tb_units un
        WHERE ${where}
        ORDER BY ${UNIT_ORDER}`,
      params,
    );
  }
}
