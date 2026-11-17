import type { MigrationInterface, QueryRunner } from "typeorm";

// Bookings (spaces, bookings, guests, fees) become a module contracted
// apart, like events. Every condominium that exists keeps it on; new ones
// get it when the platform turns it on.
export class BookingsModule1800000000018 implements MigrationInterface {
  name = "BookingsModule1800000000018";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_condominium_modules"
        DROP CONSTRAINT "ck_condominium_modules_module",
        ADD CONSTRAINT "ck_condominium_modules_module"
          CHECK ("module" IN ('EVENTS', 'BOOKINGS'))`);
    await queryRunner.query(`
      INSERT INTO "tb_condominium_modules" ("idtb_condominiums", "module")
      SELECT "idtb_condominiums", 'BOOKINGS' FROM "tb_condominiums"
      ON CONFLICT DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "tb_condominium_modules" WHERE "module" = 'BOOKINGS'`,
    );
    await queryRunner.query(`
      ALTER TABLE "tb_condominium_modules"
        DROP CONSTRAINT "ck_condominium_modules_module",
        ADD CONSTRAINT "ck_condominium_modules_module"
          CHECK ("module" IN ('EVENTS'))`);
  }
}
