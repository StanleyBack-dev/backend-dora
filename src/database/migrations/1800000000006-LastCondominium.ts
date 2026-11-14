import type { MigrationInterface, QueryRunner } from "typeorm";

// The condominium each account worked in last, so a new login (after
// logging out or losing the session) reopens it. Works for the platform
// administrator too, who has no memberships. Deleting the condominium just
// forgets the choice.
export class LastCondominium1800000000006 implements MigrationInterface {
  name = "LastCondominium1800000000006";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_users"
        ADD COLUMN "last_condominium_id" uuid
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_users" DROP COLUMN "last_condominium_id"`,
    );
  }
}
