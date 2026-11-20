import type { MigrationInterface, QueryRunner } from "typeorm";

// A parcel registered for a resident by name (not only for the unit): only
// that resident is told about it and sees it (a surprise or a gift stays
// private from the rest of the household). Null: the whole unit, as before.
export class ParcelRecipient1800000000021 implements MigrationInterface {
  name = "ParcelRecipient1800000000021";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_parcels"
        ADD COLUMN "recipient_user_id" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL`);
    await queryRunner.query(
      `CREATE INDEX "ix_parcels_recipient" ON "tb_parcels" ("recipient_user_id") WHERE "recipient_user_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_parcels_recipient"`);
    await queryRunner.query(
      `ALTER TABLE "tb_parcels" DROP COLUMN "recipient_user_id"`,
    );
  }
}
