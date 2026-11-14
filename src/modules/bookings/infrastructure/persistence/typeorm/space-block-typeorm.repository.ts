import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type {
  SpaceBlockRepositoryPort,
  SpaceBlockView,
} from "@/modules/bookings/application/ports/space-block-repository.port";
import type { SpaceBlock } from "@/modules/bookings/domain/space-block";
import { SpaceBlockOrmEntity } from "@/modules/bookings/infrastructure/persistence/typeorm/space-block.orm-entity";

const toBlock = (row: SpaceBlockOrmEntity): SpaceBlock => ({
  id: row.id,
  condominiumId: row.condominiumId,
  spaceId: row.spaceId,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  reason: row.reason,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

@Injectable()
export class SpaceBlockTypeormRepository implements SpaceBlockRepositoryPort {
  constructor(
    @InjectRepository(SpaceBlockOrmEntity)
    private readonly repository: Repository<SpaceBlockOrmEntity>,
  ) {}

  // The author's name comes from tb_users (identity), read-only.
  upcoming(spaceId: string, from: Date): Promise<SpaceBlockView[]> {
    return this.repository.manager.query<SpaceBlockView[]>(
      `SELECT k.idtb_space_blocks AS id, k.idtb_condominiums AS "condominiumId",
              k.idtb_spaces AS "spaceId", k.starts_at AS "startsAt",
              k.ends_at AS "endsAt", k.reason, k.created_by AS "createdBy",
              k.created_at AS "createdAt", u.name AS "createdByName"
         FROM tb_space_blocks k
         LEFT JOIN tb_users u ON u.idtb_users = k.created_by
        WHERE k.idtb_spaces = $1 AND k.ends_at > $2
        ORDER BY k.starts_at`,
      [spaceId, from],
    );
  }

  async overlapping(
    spaceId: string,
    from: Date,
    to: Date,
  ): Promise<SpaceBlock[]> {
    const rows = await this.repository
      .createQueryBuilder("block")
      .where("block.idtb_spaces = :spaceId", { spaceId })
      .andWhere("block.starts_at < :to AND block.ends_at > :from", {
        from,
        to,
      })
      .orderBy("block.starts_at")
      .getMany();
    return rows.map(toBlock);
  }

  async find(condominiumId: string, id: string): Promise<SpaceBlock | null> {
    const row = await this.repository.findOne({ where: { id, condominiumId } });
    return row ? toBlock(row) : null;
  }

  async create(
    data: Pick<
      SpaceBlock,
      "condominiumId" | "spaceId" | "startsAt" | "endsAt" | "reason"
    >,
  ): Promise<SpaceBlock> {
    return toBlock(await this.repository.save(this.repository.create(data)));
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
