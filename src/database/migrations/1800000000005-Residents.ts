import type { MigrationInterface, QueryRunner } from "typeorm";

// Residents' details: a contact phone on the account, the address complement
// inside the condominium on the membership ("casa dos fundos"), and on
// sign-ups the complement plus the block/number typed when the condominium
// has no units registered yet (the manager links them on approval).
export class Residents1800000000005 implements MigrationInterface {
  name = "Residents1800000000005";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_users"
        ADD COLUMN "phone" varchar(11) CHECK ("phone" ~ '^[0-9]{10,11}$')
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_memberships"
        ADD COLUMN "unit_complement" varchar(80)
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_requests"
        ADD COLUMN "unit_complement" varchar(80),
        ADD COLUMN "typed_unit_block" varchar(30),
        ADD COLUMN "typed_unit_number" varchar(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_requests"
        DROP COLUMN "typed_unit_number",
        DROP COLUMN "typed_unit_block",
        DROP COLUMN "unit_complement"
    `);
    await queryRunner.query(
      `ALTER TABLE "tb_memberships" DROP COLUMN "unit_complement"`,
    );
    await queryRunner.query(`ALTER TABLE "tb_users" DROP COLUMN "phone"`);
  }
}
