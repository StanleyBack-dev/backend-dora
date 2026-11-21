import type { MigrationInterface, QueryRunner } from "typeorm";

// Lost and found: the gate may know whose an item is when registering it,
// like a parcel: a unit (its residents are told and see it) or one of its
// residents (only them). While reserved, the item is left out of the list
// every resident browses; "Não é meu" (or the desk) lifts it.
export class FoundItemOwner1800000000026 implements MigrationInterface {
  name = "FoundItemOwner1800000000026";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_found_items"
        ADD COLUMN "owner_unit_id" uuid
          REFERENCES "tb_units" ("idtb_units") ON DELETE SET NULL,
        ADD COLUMN "owner_user_id" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL`);
    await queryRunner.query(
      `CREATE INDEX "ix_found_items_owner_unit" ON "tb_found_items" ("owner_unit_id") WHERE "owner_unit_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_found_items_owner_unit"`);
    await queryRunner.query(`
      ALTER TABLE "tb_found_items"
        DROP COLUMN "owner_user_id",
        DROP COLUMN "owner_unit_id"`);
  }
}
