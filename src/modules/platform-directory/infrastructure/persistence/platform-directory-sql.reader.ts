import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import type {
  CondominiumMember,
  PersonMembership,
  PlatformDirectoryReaderPort,
  PlatformPerson,
} from "@/modules/platform-directory/application/ports/platform-directory-reader.port";
import type { PeopleFilter } from "@/modules/platform-directory/domain/people-filter";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";

type PersonRow = Omit<PlatformPerson, "platformAdmin" | "memberships"> & {
  group: UserGroup;
};
type MembershipRow = PersonMembership & { userId: string };
type MemberRow = Omit<CondominiumMember, "unitLabel"> & {
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
};

/** Managers first, then the gate, then residents. */
const ROLE_ORDER = `CASE m.role WHEN 'ADMIN' THEN 0 WHEN 'CONCIERGE' THEN 1 ELSE 2 END`;

// The platform's directory: read-only, across identity (users, memberships,
// residents, employees, credentials) and condominiums (names, units). Only
// the platform administrator reaches it (CONDOMINIUMS_MANAGE).
@Injectable()
export class PlatformDirectorySqlReader implements PlatformDirectoryReaderPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async people(
    filter: PeopleFilter,
    page: PageRequest,
  ): Promise<Paginated<PlatformPerson>> {
    // $1 pattern, $2 role, $3 condominium.
    const where = `
      WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email ILIKE $1
             OR u.username ILIKE $1)
        AND ($2::varchar IS NULL
             OR ($2 = '${UserGroup.ADMIN_MASTER}' AND u."group" = $2)
             OR EXISTS (SELECT 1 FROM tb_memberships m
                         WHERE m.idtb_users = u.idtb_users AND m.role = $2
                           AND m.active))
        AND ($3::uuid IS NULL
             OR EXISTS (SELECT 1 FROM tb_memberships m
                         WHERE m.idtb_users = u.idtb_users
                           AND m.idtb_condominiums = $3))`;
    const params = [filter.pattern, filter.role, filter.condominiumId];
    const [{ total }] = await this.dataSource.query<{ total: number }[]>(
      `SELECT count(*)::int AS total FROM tb_users u ${where}`,
      params,
    );
    const rows = await this.dataSource.query<PersonRow[]>(
      `SELECT u.idtb_users AS id, u.name, u.email, u.username, u.phone,
              u."group", u.active, c.locked_until AS "lockedUntil",
              u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt"
         FROM tb_users u
         LEFT JOIN tb_auth_credentials c ON c.idtb_users = u.idtb_users
         ${where}
        ORDER BY lower(u.name), u.idtb_users
        LIMIT $4 OFFSET $5`,
      [...params, page.limit, (page.page - 1) * page.limit],
    );
    const memberships =
      rows.length === 0
        ? []
        : await this.dataSource.query<MembershipRow[]>(
            `SELECT m.idtb_users AS "userId",
                    m.idtb_condominiums AS "condominiumId",
                    co.name AS "condominiumName", m.role, m.kind, m.active
               FROM tb_memberships m
               JOIN tb_condominiums co
                 ON co.idtb_condominiums = m.idtb_condominiums
              WHERE m.idtb_users = ANY($1::uuid[])
              ORDER BY m.active DESC, lower(co.name)`,
            [rows.map((row) => row.id)],
          );
    const items = rows.map(({ group, ...person }) => ({
      ...person,
      platformAdmin: group === UserGroup.ADMIN_MASTER,
      memberships: memberships
        .filter((membership) => membership.userId === person.id)
        .map((membership) => {
          const { userId, ...rest } = membership;
          void userId;
          return rest;
        }),
    }));
    return paginate(items, total, page);
  }

  async membersOf(condominiumId: string): Promise<CondominiumMember[]> {
    const rows = await this.dataSource.query<MemberRow[]>(
      `SELECT u.idtb_users AS "userId", u.name, u.email, u.username, u.phone,
              m.role, m.kind, m.active, un.street AS "unitStreet",
              un.block AS "unitBlock", un.number AS "unitNumber",
              e.job_title AS "jobTitle", u.last_login_at AS "lastLoginAt",
              m.created_at AS since
         FROM tb_memberships m
         JOIN tb_users u ON u.idtb_users = m.idtb_users
         LEFT JOIN tb_residents r ON r.idtb_memberships = m.idtb_memberships
         LEFT JOIN tb_units un ON un.idtb_units = r.idtb_units
         LEFT JOIN tb_employees e ON e.idtb_memberships = m.idtb_memberships
        WHERE m.idtb_condominiums = $1
        ORDER BY m.active DESC, ${ROLE_ORDER}, lower(u.name)
        LIMIT 5000`,
      [condominiumId],
    );
    return rows.map(({ unitStreet, unitBlock, unitNumber, ...member }) => ({
      ...member,
      unitLabel:
        unitNumber !== null
          ? unitLabel({
              street: unitStreet,
              block: unitBlock ?? "",
              number: unitNumber,
            })
          : null,
    }));
  }
}
