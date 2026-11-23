import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Purchases: a placed order may be cancelled (nothing received nor paid
 * yet), with the reason; the purchase goes back to "approved" and a new
 * order may be placed, so only one order per request stays active.
 */
export class PurchaseOrderCancel1800000000037 implements MigrationInterface {
  name = "PurchaseOrderCancel1800000000037";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_purchase_orders"
        ADD COLUMN "cancelled_at" timestamptz,
        ADD COLUMN "cancelled_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        ADD COLUMN "cancel_reason" varchar(300),
        ADD CONSTRAINT "ck_purchase_orders_cancel" CHECK (
          ("cancelled_at" IS NULL) = ("cancel_reason" IS NULL)
        )
    `);
    await queryRunner.query(
      `ALTER TABLE "tb_purchase_orders" DROP CONSTRAINT "tb_purchase_orders_idtb_purchase_requests_key"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_purchase_orders_active" ON "tb_purchase_orders" ("idtb_purchase_requests") WHERE "cancelled_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_purchase_orders_active"`);
    await queryRunner.query(
      `DELETE FROM "tb_purchase_orders" WHERE "cancelled_at" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_purchase_orders" ADD CONSTRAINT "tb_purchase_orders_idtb_purchase_requests_key" UNIQUE ("idtb_purchase_requests")`,
    );
    await queryRunner.query(`
      ALTER TABLE "tb_purchase_orders"
        DROP CONSTRAINT "ck_purchase_orders_cancel",
        DROP COLUMN "cancel_reason",
        DROP COLUMN "cancelled_by",
        DROP COLUMN "cancelled_at"
    `);
  }
}
