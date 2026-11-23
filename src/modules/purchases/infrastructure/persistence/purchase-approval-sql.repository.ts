import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource, EntityManager } from "typeorm";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";
import { OutboxTypeormWriter } from "@/modules/outbox/infrastructure/persistence/typeorm/outbox-typeorm.repository";
import type {
  ApprovalOutcome,
  ApprovalOverview,
  PurchaseApprovalRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import {
  ApprovalDecision,
  type ApprovalMode,
  DEFAULT_PURCHASE_SETTINGS,
  type NewApproval,
  type PurchaseApproval,
  type PurchaseSettings,
} from "@/modules/purchases/domain/purchase-approval";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";

const AWAITING = PurchaseRequestStatus.AWAITING_APPROVAL;

/** Writes one decision (also used when a quote is approved on choosing). */
export async function insertApproval(
  manager: EntityManager,
  approval: NewApproval,
): Promise<void> {
  await manager.query(
    `INSERT INTO tb_purchase_approvals (
       idtb_purchase_requests, idtb_purchase_quotes, decision, supplier_name,
       total_cents, limit_cents, note, chosen_by, decided_by, decided_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      approval.requestId,
      approval.quoteId,
      approval.decision,
      approval.supplierName,
      approval.totalCents,
      approval.limitCents,
      approval.note,
      approval.chosenById,
      approval.decidedById,
      approval.decidedAt,
    ],
  );
}

type ApprovalRow = Omit<PurchaseApproval, "totalCents" | "limitCents"> & {
  totalCents: string;
  limitCents: string | null;
};

// The approval settings of each condominium and the decisions on each
// request (names from the users, read-only).
@Injectable()
export class PurchaseApprovalSqlRepository implements PurchaseApprovalRepositoryPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxTypeormWriter,
  ) {}

  async settings(condominiumId: string): Promise<PurchaseSettings> {
    const [row] = await this.dataSource.query<
      {
        approvalMode: ApprovalMode;
        approvalLimitCents: string | null;
        updatedAt: Date;
        updatedByName: string | null;
      }[]
    >(
      `SELECT s.approval_mode AS "approvalMode",
              s.approval_limit_cents AS "approvalLimitCents",
              s.updated_at AS "updatedAt", u.name AS "updatedByName"
         FROM tb_purchase_settings s
         LEFT JOIN tb_users u ON u.idtb_users = s.updated_by
        WHERE s.idtb_condominiums = $1`,
      [condominiumId],
    );
    if (!row) return DEFAULT_PURCHASE_SETTINGS;
    return {
      ...row,
      approvalLimitCents:
        row.approvalLimitCents === null ? null : Number(row.approvalLimitCents),
    };
  }

  async saveSettings(
    condominiumId: string,
    mode: ApprovalMode,
    limitCents: number | null,
    updatedBy: string,
  ): Promise<PurchaseSettings> {
    await this.dataSource.query(
      `INSERT INTO tb_purchase_settings
         (idtb_condominiums, approval_mode, approval_limit_cents, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (idtb_condominiums) DO UPDATE
         SET approval_mode = EXCLUDED.approval_mode,
             approval_limit_cents = EXCLUDED.approval_limit_cents,
             updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [condominiumId, mode, limitCents, updatedBy],
    );
    return this.settings(condominiumId);
  }

  async history(requestId: string): Promise<PurchaseApproval[]> {
    const rows = await this.dataSource.query<ApprovalRow[]>(
      `SELECT a.idtb_purchase_approvals AS id,
              a.idtb_purchase_requests AS "requestId",
              a.idtb_purchase_quotes AS "quoteId",
              a.decision, a.supplier_name AS "supplierName",
              a.total_cents AS "totalCents", a.limit_cents AS "limitCents",
              a.note, a.chosen_by AS "chosenById", c.name AS "chosenByName",
              a.decided_by AS "decidedById", d.name AS "decidedByName",
              a.decided_at AS "decidedAt"
         FROM tb_purchase_approvals a
         LEFT JOIN tb_users c ON c.idtb_users = a.chosen_by
         LEFT JOIN tb_users d ON d.idtb_users = a.decided_by
        WHERE a.idtb_purchase_requests = $1
        ORDER BY a.decided_at DESC, a.idtb_purchase_approvals`,
      [requestId],
    );
    return rows.map((row) => ({
      ...row,
      totalCents: Number(row.totalCents),
      limitCents: row.limitCents === null ? null : Number(row.limitCents),
    }));
  }

  decide(
    requestId: string,
    outcome: ApprovalOutcome,
    approval: NewApproval,
    notices: OutboxDraft[],
  ): Promise<boolean> {
    // Back to quotes, the choice is undone (as reopening does).
    const undoChoice =
      outcome === PurchaseRequestStatus.QUOTING
        ? `, chosen_quote_id = NULL, choice_justification = NULL,
             chosen_by = NULL, chosen_at = NULL`
        : "";
    return this.dataSource.transaction(async (manager) => {
      const changed = await manager.query<{ id: string }[]>(
        `UPDATE tb_purchase_requests
            SET status = $2${undoChoice}, updated_at = now()
          WHERE idtb_purchase_requests = $1 AND status = '${AWAITING}'
          RETURNING idtb_purchase_requests AS id`,
        [requestId, outcome],
      );
      if (changed.length === 0) return false;
      await insertApproval(manager, approval);
      await this.outbox.write(manager, notices);
      return true;
    });
  }

  async overview(
    condominiumId: string,
    monthStart: Date,
  ): Promise<ApprovalOverview> {
    const [row] = await this.dataSource.query<ApprovalOverview[]>(
      `SELECT
         (SELECT count(*)::int FROM tb_purchase_requests r
           WHERE r.idtb_condominiums = $1 AND r.status = '${AWAITING}') AS awaiting,
         count(*) FILTER (WHERE a.decision IN ('${ApprovalDecision.APPROVED}', '${ApprovalDecision.AUTO_APPROVED}'))::int
           AS "approvedThisMonth",
         count(*) FILTER (WHERE a.decision = '${ApprovalDecision.RETURNED}')::int
           AS "returnedThisMonth",
         count(*) FILTER (WHERE a.decision = '${ApprovalDecision.REJECTED}')::int
           AS "rejectedThisMonth"
         FROM tb_purchase_approvals a
         JOIN tb_purchase_requests r
           ON r.idtb_purchase_requests = a.idtb_purchase_requests
        WHERE r.idtb_condominiums = $1 AND a.decided_at >= $2`,
      [condominiumId, monthStart],
    );
    return row;
  }
}
