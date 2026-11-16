import type { MigrationInterface, QueryRunner } from "typeorm";

// When an event stops taking orders, set per event: some hours before it
// starts (0: at the start, as until now) or only when it ends (orders during
// the event). Existing events keep closing at the start.
export class EventSalesClose1800000000017 implements MigrationInterface {
  name = "EventSalesClose1800000000017";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_events"
        ADD COLUMN "sales_close" varchar(12) NOT NULL DEFAULT 'BEFORE_START'
          CHECK ("sales_close" IN ('BEFORE_START', 'AT_END')),
        ADD COLUMN "sales_close_hours" smallint NOT NULL DEFAULT 0
          CHECK ("sales_close_hours" BETWEEN 0 AND 720),
        ADD CONSTRAINT "ck_events_sales_close_hours"
          CHECK ("sales_close" = 'BEFORE_START' OR "sales_close_hours" = 0)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_events"
        DROP CONSTRAINT "ck_events_sales_close_hours",
        DROP COLUMN "sales_close_hours",
        DROP COLUMN "sales_close"`);
  }
}
