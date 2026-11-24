import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Purchases: the condominium may publish its accounts to the residents
 * (prestação de contas: what was spent, by category and month, and the
 * purchases completed). Off by default; the approvers turn it on, and who
 * did and when is kept apart from the approval rule's.
 */
export class PurchaseTransparency1800000000038 implements MigrationInterface {
  name = "PurchaseTransparency1800000000038";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_purchase_settings"
        ADD COLUMN "transparency_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN "transparency_updated_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        ADD COLUMN "transparency_updated_at" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_purchase_settings"
        DROP COLUMN "transparency_updated_at",
        DROP COLUMN "transparency_updated_by",
        DROP COLUMN "transparency_enabled"
    `);
  }
}
