import type { MigrationInterface, QueryRunner } from "typeorm";

// Purchases: the approval of the chosen quote (aprovação por alçada).
//
// tb_purchase_settings: how a condominium approves its purchases, set by
// whoever approves them. ALWAYS: every chosen quote waits for an approver.
// LIMIT: up to approval_limit_cents it is approved on choosing ("dentro da
// alçada"); above it, it waits.
//
// tb_purchase_approvals: every decision on a request, kept as it was then
// (supplier, total, the limit in force): approved on choosing (AUTO),
// approved, returned to quotes or rejected by an approver, with the note.
// The request's status follows the last one.
export class PurchaseApprovals1800000000035 implements MigrationInterface {
  name = "PurchaseApprovals1800000000035";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_purchase_settings" (
        "idtb_condominiums" uuid PRIMARY KEY
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "approval_mode" varchar(6) NOT NULL DEFAULT 'ALWAYS'
          CHECK ("approval_mode" IN ('ALWAYS', 'LIMIT')),
        "approval_limit_cents" bigint
          CHECK ("approval_limit_cents" BETWEEN 0 AND 100000000000),
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_purchase_settings_limit" CHECK (
          ("approval_mode" = 'LIMIT') = ("approval_limit_cents" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tb_purchase_approvals" (
        "idtb_purchase_approvals" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_purchase_requests" uuid NOT NULL
          REFERENCES "tb_purchase_requests" ("idtb_purchase_requests") ON DELETE CASCADE,
        "idtb_purchase_quotes" uuid
          REFERENCES "tb_purchase_quotes" ("idtb_purchase_quotes") ON DELETE SET NULL,
        "decision" varchar(13) NOT NULL
          CHECK ("decision" IN ('AUTO_APPROVED', 'APPROVED', 'RETURNED', 'REJECTED')),
        "supplier_name" varchar(160) NOT NULL,
        "total_cents" bigint NOT NULL CHECK ("total_cents" >= 0),
        "limit_cents" bigint,
        "note" varchar(300),
        "chosen_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "decided_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "decided_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_purchase_approvals_note" CHECK (
          "decision" NOT IN ('RETURNED', 'REJECTED') OR "note" IS NOT NULL
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_purchase_approvals_request" ON "tb_purchase_approvals" ("idtb_purchase_requests", "decided_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_purchase_approvals"`);
    await queryRunner.query(`DROP TABLE "tb_purchase_settings"`);
  }
}
