import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type {
  SpaceData,
  SpacePatch,
  SpaceRepositoryPort,
} from "@/modules/spaces/application/ports/space-repository.port";
import type { Space } from "@/modules/spaces/domain/space";
import { SpaceOrmEntity } from "@/modules/spaces/infrastructure/persistence/typeorm/space.orm-entity";

const toSpace = (row: SpaceOrmEntity): Space => ({
  id: row.id,
  condominiumId: row.condominiumId,
  name: row.name,
  kind: row.kind,
  description: row.description,
  capacity: row.capacity,
  usageRules: row.usageRules,
  active: row.active,
  rules: {
    openingHours: row.openingHours,
    slotMinutes: row.slotMinutes,
    minAdvanceHours: row.minAdvanceHours,
    maxAdvanceDays: row.maxAdvanceDays,
    unitLimit:
      row.unitLimitCount !== null && row.unitLimitPeriod !== null
        ? { count: row.unitLimitCount, period: row.unitLimitPeriod }
        : null,
    requiresApproval: row.requiresApproval,
    cancelUntilHours: row.cancelUntilHours,
  },
  photos: row.photos ?? [],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** The space's data as columns (rules flattened). */
function toColumns(data: SpacePatch): Partial<SpaceOrmEntity> {
  const { rules, ...details } = data;
  const columns: Partial<SpaceOrmEntity> = Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
  if (rules) {
    Object.assign(columns, {
      openingHours: rules.openingHours,
      slotMinutes: rules.slotMinutes,
      minAdvanceHours: rules.minAdvanceHours,
      maxAdvanceDays: rules.maxAdvanceDays,
      unitLimitCount: rules.unitLimit?.count ?? null,
      unitLimitPeriod: rules.unitLimit?.period ?? null,
      requiresApproval: rules.requiresApproval,
      cancelUntilHours: rules.cancelUntilHours,
    });
  }
  return columns;
}

@Injectable()
export class SpaceTypeormRepository implements SpaceRepositoryPort {
  constructor(
    @InjectRepository(SpaceOrmEntity)
    private readonly repository: Repository<SpaceOrmEntity>,
  ) {}

  async list(
    condominiumId: string,
    includeInactive: boolean,
  ): Promise<Space[]> {
    const query = this.repository
      .createQueryBuilder("space")
      .where("space.idtb_condominiums = :condominiumId", { condominiumId })
      .orderBy("space.active", "DESC")
      .addOrderBy("unaccent(space.name)", "ASC");
    if (!includeInactive) query.andWhere("space.active");
    return (await query.getMany()).map(toSpace);
  }

  async find(condominiumId: string, id: string): Promise<Space | null> {
    const row = await this.repository.findOne({ where: { id, condominiumId } });
    return row ? toSpace(row) : null;
  }

  async findByName(condominiumId: string, name: string): Promise<Space | null> {
    const row = await this.repository
      .createQueryBuilder("space")
      .where("space.idtb_condominiums = :condominiumId", { condominiumId })
      .andWhere("lower(space.name) = lower(:name)", { name })
      .getOne();
    return row ? toSpace(row) : null;
  }

  async create(condominiumId: string, data: SpaceData): Promise<Space> {
    const row = await this.repository.save(
      this.repository.create({ ...toColumns(data), condominiumId }),
    );
    return toSpace(row);
  }

  async update(id: string, patch: SpacePatch): Promise<Space> {
    const columns = toColumns(patch);
    if (Object.keys(columns).length > 0) {
      await this.repository.update({ id }, columns);
    }
    return toSpace(await this.repository.findOneOrFail({ where: { id } }));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }

  // tb_bookings belongs to the bookings module: read-only existence check.
  async hasBookings(id: string): Promise<boolean> {
    const rows = await this.repository.manager.query<unknown[]>(
      `SELECT 1 FROM tb_bookings WHERE idtb_spaces = $1 LIMIT 1`,
      [id],
    );
    return rows.length > 0;
  }
}
