import type { MigrationInterface, QueryRunner } from "typeorm";

// Perishable parcels (food, medicine, flowers…): picked up by a deadline
// set when they arrive. Residents are reminded every few hours until then,
// and told once when it passes; the desk sees them first, flagged.
export class ParcelPerishable1800000000022 implements MigrationInterface {
  name = "ParcelPerishable1800000000022";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_parcels"
        ADD COLUMN "perishable" boolean NOT NULL DEFAULT false,
        ADD COLUMN "pickup_deadline" timestamptz,
        ADD COLUMN "perishable_reminded_at" timestamptz,
        ADD COLUMN "overdue_notified_at" timestamptz,
        ADD CONSTRAINT "ck_parcels_perishable_deadline"
          CHECK ("perishable" = ("pickup_deadline" IS NOT NULL))`);
    await queryRunner.query(
      `CREATE INDEX "ix_parcels_perishable_waiting" ON "tb_parcels" ("pickup_deadline") WHERE "perishable" AND "status" = 'RECEIVED'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_parcels_perishable_waiting"`);
    await queryRunner.query(`
      ALTER TABLE "tb_parcels"
        DROP CONSTRAINT "ck_parcels_perishable_deadline",
        DROP COLUMN "overdue_notified_at",
        DROP COLUMN "perishable_reminded_at",
        DROP COLUMN "pickup_deadline",
        DROP COLUMN "perishable"`);
  }
}
