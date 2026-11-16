import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type {
  DependentRepositoryPort,
  NewDependent,
} from "@/modules/dependents/application/ports/dependent-repository.port";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import {
  DependentStatus,
  type Dependent,
} from "@/modules/dependents/domain/dependent";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";

type DependentRow = Omit<Dependent, "unitLabel"> & {
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
};

// The holder's name and unit come from tb_memberships, tb_users,
// tb_residents and tb_units (identity and condominiums), read-only.
const SELECT = `
  SELECT d.idtb_dependents AS id, d.idtb_condominiums AS "condominiumId",
         d.idtb_memberships AS "membershipId", u.name AS "holderName",
         un.street AS "unitStreet", un.block AS "unitBlock",
         un.number AS "unitNumber",
         d.name, to_char(d.birth_date, 'YYYY-MM-DD') AS "birthDate",
         d.relationship, d.document_key AS "documentKey",
         d.document_content_type AS "documentContentType", d.status,
         d.reviewed_at AS "reviewedAt", d.reject_reason AS "rejectReason",
         d.created_at AS "createdAt"
    FROM tb_dependents d
    JOIN tb_memberships m ON m.idtb_memberships = d.idtb_memberships
    JOIN tb_users u ON u.idtb_users = m.idtb_users
    LEFT JOIN tb_residents r ON r.idtb_memberships = m.idtb_memberships
    LEFT JOIN tb_units un ON un.idtb_units = r.idtb_units`;

const toDependent = (row: DependentRow): Dependent => {
  const { unitStreet, unitBlock, unitNumber, ...dependent } = row;
  return {
    ...dependent,
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

// Dependents: raw SQL; creating and reviewing store their notices in the
// outbox in the same transaction.
@Injectable()
export class DependentSqlRepository implements DependentRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async listByMembership(membershipId: string): Promise<Dependent[]> {
    const rows = await this.dataSource.query<DependentRow[]>(
      `${SELECT} WHERE d.idtb_memberships = $1 ORDER BY unaccent(d.name)`,
      [membershipId],
    );
    return rows.map(toDependent);
  }

  async listForReview(
    condominiumId: string,
    status: DependentStatus | null,
  ): Promise<Dependent[]> {
    const rows = await this.dataSource.query<DependentRow[]>(
      `${SELECT}
        WHERE d.idtb_condominiums = $1
          AND ($2::varchar IS NULL OR d.status = $2)
        ORDER BY d.created_at
        LIMIT 500`,
      [condominiumId, status],
    );
    return rows.map(toDependent);
  }

  async find(condominiumId: string, id: string): Promise<Dependent | null> {
    const [row] = await this.dataSource.query<DependentRow[]>(
      `${SELECT} WHERE d.idtb_condominiums = $1 AND d.idtb_dependents = $2`,
      [condominiumId, id],
    );
    return row ? toDependent(row) : null;
  }

  async countByMembership(membershipId: string): Promise<number> {
    const [row] = await this.dataSource.query<{ count: number }[]>(
      `SELECT count(*)::int AS count FROM tb_dependents WHERE idtb_memberships = $1`,
      [membershipId],
    );
    return row.count;
  }

  create(dependent: NewDependent, notices: OutboxDraft[]): Promise<Dependent> {
    return this.dataSource.transaction(async (manager) => {
      const [row] = await manager.query<{ id: string }[]>(
        `INSERT INTO tb_dependents
           (idtb_condominiums, idtb_memberships, name, birth_date,
            relationship, document_key, document_content_type,
            created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING idtb_dependents AS id`,
        [
          dependent.condominiumId,
          dependent.membershipId,
          dependent.name,
          dependent.birthDate,
          dependent.relationship,
          dependent.documentKey,
          dependent.documentContentType,
          dependent.createdBy,
        ],
      );
      if (notices.length > 0) await this.outbox.write(manager, notices);
      return this.get(manager, row.id);
    });
  }

  review(
    id: string,
    decision: {
      status: DependentStatus.APPROVED | DependentStatus.REJECTED;
      reviewerId: string;
      reason: string | null;
      at: Date;
    },
    notices: OutboxDraft[],
  ): Promise<Dependent | null> {
    return this.dataSource.transaction(async (manager) => {
      const [rows] = await manager.query<[unknown[], number]>(
        `UPDATE tb_dependents
            SET status = $2, reviewed_by = $3, reviewed_at = $4,
                reject_reason = $5, updated_by = $3, updated_at = now()
          WHERE idtb_dependents = $1 AND status = '${DependentStatus.PENDING}'
          RETURNING idtb_dependents`,
        [
          id,
          decision.status,
          decision.reviewerId,
          decision.at,
          decision.reason,
        ],
      );
      if (rows.length === 0) return null;
      if (notices.length > 0) await this.outbox.write(manager, notices);
      return this.get(manager, id);
    });
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM tb_dependents WHERE idtb_dependents = $1`,
      [id],
    );
  }

  private async get(manager: EntityManager, id: string): Promise<Dependent> {
    const [row] = await manager.query<DependentRow[]>(
      `${SELECT} WHERE d.idtb_dependents = $1`,
      [id],
    );
    return toDependent(row);
  }
}
