import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import {
  Not,
  type DataSource,
  type EntityManager,
  type Repository,
} from "typeorm";
import type { UserGroup } from "@/modules/access-control/domain/user-group";
import type {
  MembershipPatch,
  MembershipRepositoryPort,
  NewMembership,
} from "@/modules/identity/application/ports/membership-repository.port";
import type { MemberProfile } from "@/modules/identity/domain/member-profile";
import type {
  MemberCondominium,
  Membership,
} from "@/modules/identity/domain/membership";
import { MembershipOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/membership.orm-entity";
import {
  insertMembership,
  readProfile,
  writeProfile,
} from "@/modules/identity/infrastructure/persistence/typeorm/repositories/member-profile.store";

const toMembership = (
  row: MembershipOrmEntity,
  profile: MemberProfile,
): Membership => ({
  id: row.id,
  userId: row.userId,
  condominiumId: row.condominiumId,
  role: row.role,
  profile,
  active: row.active,
  lastSelectedAt: row.lastSelectedAt,
  createdAt: row.createdAt,
});

// Condominium names and status come from tb_condominiums (condominiums
// module), read-only.
@Injectable()
export class MembershipTypeormRepository implements MembershipRepositoryPort {
  constructor(
    @InjectRepository(MembershipOrmEntity)
    private readonly repository: Repository<MembershipOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async find(
    userId: string,
    condominiumId: string,
  ): Promise<Membership | null> {
    const row = await this.repository.findOne({
      where: { userId, condominiumId },
    });
    return row ? this.withProfile(this.dataSource.manager, row) : null;
  }

  create(membership: NewMembership): Promise<Membership> {
    return this.dataSource.transaction(async (manager) =>
      this.withProfile(manager, await insertMembership(manager, membership)),
    );
  }

  update(id: string, patch: MembershipPatch): Promise<Membership> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MembershipOrmEntity);
      const current = await repository.findOneOrFail({ where: { id } });
      const changes = Object.fromEntries(
        Object.entries({ role: patch.role, active: patch.active }).filter(
          ([, value]) => value !== undefined,
        ),
      );
      if (Object.keys(changes).length > 0) {
        await repository.update({ id }, changes);
      }
      if (patch.profile) {
        await writeProfile(manager, id, patch.profile, current.kind);
      }
      return this.withProfile(
        manager,
        await repository.findOneOrFail({ where: { id } }),
      );
    });
  }

  private async withProfile(
    manager: EntityManager,
    row: MembershipOrmEntity,
  ): Promise<Membership> {
    return toMembership(row, await readProfile(manager, row.id, row.kind));
  }

  listOpenable(userId: string): Promise<MemberCondominium[]> {
    return this.dataSource.query<MemberCondominium[]>(
      `SELECT c.idtb_condominiums AS id, c.name, c.city, c.state, m.role
         FROM tb_memberships m
         JOIN tb_condominiums c ON c.idtb_condominiums = m.idtb_condominiums
        WHERE m.idtb_users = $1 AND m.active AND c.status = 'ACTIVE'
        ORDER BY unaccent(c.name)`,
      [userId],
    );
  }

  async defaultCondominiumId(userId: string): Promise<string | null> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT m.idtb_condominiums AS id
         FROM tb_memberships m
         JOIN tb_condominiums c ON c.idtb_condominiums = m.idtb_condominiums
        WHERE m.idtb_users = $1 AND m.active AND c.status = 'ACTIVE'
        ORDER BY m.last_selected_at DESC NULLS LAST, m.created_at
        LIMIT 1`,
      [userId],
    );
    return rows[0]?.id ?? null;
  }

  async touchSelected(
    userId: string,
    condominiumId: string,
    at: Date,
  ): Promise<void> {
    await this.repository.update(
      { userId, condominiumId },
      { lastSelectedAt: at },
    );
  }

  countElsewhere(userId: string, condominiumId: string): Promise<number> {
    return this.repository.count({
      where: { userId, condominiumId: Not(condominiumId) },
    });
  }

  async activeUserIds(
    condominiumId: string,
    role?: UserGroup,
  ): Promise<string[]> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT m.idtb_users AS id
         FROM tb_memberships m
         JOIN tb_users u ON u.idtb_users = m.idtb_users
        WHERE m.idtb_condominiums = $1 AND m.active AND u.active
          AND ($2::varchar IS NULL OR m.role = $2)`,
      [condominiumId, role ?? null],
    );
    return rows.map((row) => row.id);
  }
}
