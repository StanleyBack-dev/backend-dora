import type { MigrationInterface, QueryRunner } from "typeorm";

// Lost and found: "Achei isso" on the neighbours' board, one per person and
// report (who said they found it, their note, when). The owner and the
// desk are told once; the board remembers it for whoever said it, and the
// desk sees how many did.
export class LostReportSpots1800000000030 implements MigrationInterface {
  name = "LostReportSpots1800000000030";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_lost_report_spots" (
        "idtb_lost_reports" uuid NOT NULL
          REFERENCES "tb_lost_reports" ("idtb_lost_reports") ON DELETE CASCADE,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "note" varchar(300),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("idtb_lost_reports", "idtb_users")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_lost_report_spots"`);
  }
}
