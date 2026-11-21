import type { MigrationInterface, QueryRunner } from "typeorm";

// Lost and found: a "Perdi algo" report may be shown to the neighbours (a
// "Procura-se" board): what it is, where and when, and the photo, never
// who lost it nor the details the desk uses to check the owner. A
// neighbour who found it says so ("Achei isso"); the desk and the owner
// are told.
export class LostReportBoard1800000000029 implements MigrationInterface {
  name = "LostReportBoard1800000000029";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_lost_reports" ADD COLUMN "shared" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_lost_reports_board" ON "tb_lost_reports" ("idtb_condominiums", "created_at" DESC) WHERE "status" = 'OPEN' AND "shared"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_lost_reports_board"`);
    await queryRunner.query(
      `ALTER TABLE "tb_lost_reports" DROP COLUMN "shared"`,
    );
  }
}
