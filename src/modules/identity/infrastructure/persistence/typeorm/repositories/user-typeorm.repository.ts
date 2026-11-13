import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import {
  Brackets,
  In,
  Not,
  IsNull,
  type DataSource,
  type Repository,
} from "typeorm";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import type { NewMembership } from "@/modules/identity/application/ports/membership-repository.port";
import type {
  MemberAccount,
  NewCredential,
  NewUser,
  UserFilter,
  UserPatch,
  UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import type { User } from "@/modules/identity/domain/user";
import { CredentialOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/credential.orm-entity";
import { MembershipOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/membership.orm-entity";
import { UserOrmEntity } from "@/modules/identity/infrastructure/persistence/typeorm/entities/user.orm-entity";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

const toUser = (row: UserOrmEntity): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  username: row.username,
  group: row.group,
  active: row.active,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deactivatedAt: row.deactivatedAt,
  lastLoginAt: row.lastLoginAt,
  avatarKey: row.avatarKey,
  onboardingCompletedAt: row.onboardingCompletedAt,
});

type MemberRaw = {
  credential_must_change_password: boolean | null;
  credential_locked_until: Date | null;
  membership_id: string;
  membership_role: UserGroup;
  membership_active: boolean;
  membership_unit_id: string | null;
  unit_block: string | null;
  unit_number: string | null;
  other_memberships: string | number;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

@Injectable()
export class UserTypeormRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toUser(row) : null;
  }

  findByLogin(login: string): Promise<User | null> {
    return login.includes("@")
      ? this.findByEmail(login)
      : this.findByUsername(login);
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = await this.repository.findOne({ where: { username } });
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repository
      .createQueryBuilder("user")
      .where("lower(user.email) = lower(:email)", { email })
      .getOne();
    return row ? toUser(row) : null;
  }

  async findMember(
    condominiumId: string,
    userId: string,
  ): Promise<MemberAccount | null> {
    const { items } = await this.queryMembers(
      condominiumId,
      {},
      { page: 1, limit: 1 },
      userId,
    );
    return items[0] ?? null;
  }

  listMembers(
    condominiumId: string,
    filter: UserFilter,
    page: PageRequest,
  ): Promise<Paginated<MemberAccount>> {
    return this.queryMembers(condominiumId, filter, page);
  }

  countActiveInGroup(group: UserGroup): Promise<number> {
    return this.repository.count({ where: { group, active: true } });
  }

  async avatarKeys(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.repository.find({
      where: { id: In([...ids]), avatarKey: Not(IsNull()) },
      select: { id: true, avatarKey: true },
    });
    return new Map(rows.map((row) => [row.id, row.avatarKey as string]));
  }

  async listActiveIds(group?: UserGroup): Promise<string[]> {
    const rows = await this.repository.find({
      where: { active: true, group },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  createWithCredential(
    user: NewUser,
    credential: NewCredential,
    membership?: Omit<NewMembership, "userId">,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserOrmEntity);
      const saved = await users.save(users.create(user));
      await manager.getRepository(CredentialOrmEntity).insert({
        userId: saved.id,
        passwordHash: credential.passwordHash,
        mustChangePassword: credential.mustChangePassword,
      });
      if (membership) {
        await manager
          .getRepository(MembershipOrmEntity)
          .insert({ ...membership, userId: saved.id });
      }
      return toUser(saved);
    });
  }

  async update(id: string, patch: UserPatch): Promise<User> {
    const changes: Partial<UserOrmEntity> = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    );
    if (patch.active !== undefined) {
      changes.deactivatedAt = patch.active ? null : new Date();
    }
    if (Object.keys(changes).length > 0) {
      await this.repository.update({ id }, changes);
    }
    return toUser(await this.repository.findOneOrFail({ where: { id } }));
  }

  async touchLastLogin(id: string, at: Date): Promise<void> {
    await this.repository.update({ id }, { lastLoginAt: at });
  }

  // Units come from tb_units (condominiums module), read-only.
  private async queryMembers(
    condominiumId: string,
    filter: UserFilter,
    page: PageRequest,
    userId?: string,
  ): Promise<Paginated<MemberAccount>> {
    const query = this.repository
      .createQueryBuilder("account")
      .innerJoin(
        MembershipOrmEntity,
        "membership",
        "membership.idtb_users = account.idtb_users AND membership.idtb_condominiums = :condominiumId",
        { condominiumId },
      )
      .leftJoin("tb_units", "unit", "unit.idtb_units = membership.idtb_units")
      .leftJoin(
        CredentialOrmEntity,
        "credential",
        "credential.idtb_users = account.idtb_users",
      )
      .addSelect(
        "credential.must_change_password",
        "credential_must_change_password",
      )
      .addSelect("credential.locked_until", "credential_locked_until")
      .addSelect("membership.idtb_memberships", "membership_id")
      .addSelect("membership.role", "membership_role")
      .addSelect("membership.active", "membership_active")
      .addSelect("membership.idtb_units", "membership_unit_id")
      .addSelect("unit.block", "unit_block")
      .addSelect("unit.number", "unit_number")
      .addSelect(
        `(SELECT count(*) FROM tb_memberships other
            WHERE other.idtb_users = account.idtb_users
              AND other.idtb_condominiums <> :condominiumId)`,
        "other_memberships",
      )
      .orderBy("membership.active", "DESC")
      .addOrderBy("account.name", "ASC")
      .skip((page.page - 1) * page.limit)
      .take(page.limit);

    if (userId) query.andWhere("account.idtb_users = :userId", { userId });
    if (filter.group) {
      query.andWhere("membership.role = :role", { role: filter.group });
    }
    if (filter.active === true) {
      query.andWhere("membership.active AND account.active");
    } else if (filter.active === false) {
      query.andWhere("NOT (membership.active AND account.active)");
    }
    if (filter.unitId) {
      query.andWhere("membership.idtb_units = :unitId", {
        unitId: filter.unitId,
      });
    }
    const search = filter.search?.trim();
    if (search) {
      const term = `%${escapeLike(search)}%`;
      query.andWhere(
        new Brackets((where) =>
          where
            .where("unaccent(account.name) ILIKE unaccent(:term)", { term })
            .orWhere("account.username ILIKE :term", { term })
            .orWhere("account.email ILIKE :term", { term }),
        ),
      );
    }

    const [{ entities, raw }, total] = await Promise.all([
      query.getRawAndEntities<MemberRaw>(),
      query.getCount(),
    ]);
    const items = entities.map((row, index): MemberAccount => {
      const extra = raw[index] as MemberRaw;
      const user = toUser(row);
      return {
        ...user,
        mustChangePassword: extra.credential_must_change_password ?? false,
        lockedUntil: extra.credential_locked_until ?? null,
        membershipId: extra.membership_id,
        role: extra.membership_role,
        membershipActive: extra.membership_active,
        unitId: extra.membership_unit_id,
        unitBlock: extra.unit_block,
        unitNumber: extra.unit_number,
        sharedAccount:
          user.group === UserGroup.ADMIN_MASTER ||
          Number(extra.other_memberships) > 0,
      };
    });
    return paginate(items, total, page);
  }
}
