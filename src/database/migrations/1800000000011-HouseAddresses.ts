import type { MigrationInterface, QueryRunner } from "typeorm";

// Condominiums of houses identify homes by street, quadra and lote instead
// of block and number. Each condominium says which (apartments by default).
// A house unit keeps the quadra as the block and the lote as the number,
// plus its street; the sign-up keeps the street typed by the resident.
export class HouseAddresses1800000000011 implements MigrationInterface {
  name = "HouseAddresses1800000000011";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_condominiums"
        ADD COLUMN "address_format" varchar(10) NOT NULL DEFAULT 'APARTMENT',
        ADD CONSTRAINT "ck_condominiums_address_format"
          CHECK ("address_format" IN ('APARTMENT', 'HOUSE'))
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_units"
        ADD COLUMN "street" varchar(80) NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_requests"
        ADD COLUMN "typed_unit_street" varchar(80)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_enrollment_requests" DROP COLUMN "typed_unit_street"`,
    );
    await queryRunner.query(`ALTER TABLE "tb_units" DROP COLUMN "street"`);
    await queryRunner.query(`
      ALTER TABLE "tb_condominiums"
        DROP CONSTRAINT "ck_condominiums_address_format",
        DROP COLUMN "address_format"
    `);
  }
}
