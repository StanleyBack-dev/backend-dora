import type { MigrationInterface, QueryRunner } from "typeorm";

// Lost and found: "Perdi algo" may carry a photo of the object (or of one
// like it), seen by whoever reported and the desk. It is deleted some time
// after the report ends.
export class LostReportPhoto1800000000028 implements MigrationInterface {
  name = "LostReportPhoto1800000000028";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_lost_reports" ADD COLUMN "photo_key" varchar(300)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_lost_reports" DROP COLUMN "photo_key"`,
    );
  }
}
