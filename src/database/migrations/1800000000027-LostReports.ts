import type { MigrationInterface, QueryRunner } from "typeorm";

// Lost and found: "Perdi algo". A resident says what they lost (category,
// what it is, where and when, optional); when the desk registers an item of
// that category, they are told it may be theirs. The report ends when they
// found it (or the desk handed it back), when they give up, or after the
// keeping period without news.
export class LostReports1800000000027 implements MigrationInterface {
  name = "LostReports1800000000027";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_lost_reports" (
        "idtb_lost_reports" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "category" varchar(12) NOT NULL
          CHECK ("category" IN ('DOCUMENT', 'KEYS', 'ELECTRONICS', 'CLOTHING',
                                'ACCESSORY', 'BAG', 'TOY', 'OTHER')),
        "title" varchar(80) NOT NULL,
        "description" varchar(300),
        "lost_location" varchar(80),
        "lost_on" date,
        "status" varchar(9) NOT NULL DEFAULT 'OPEN'
          CHECK ("status" IN ('OPEN', 'FOUND', 'CANCELLED', 'EXPIRED')),
        "idtb_found_items" uuid
          REFERENCES "tb_found_items" ("idtb_found_items") ON DELETE SET NULL,
        "closed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_lost_reports_closed" CHECK (
          ("status" = 'OPEN') = ("closed_at" IS NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_lost_reports_open" ON "tb_lost_reports" ("idtb_condominiums", "category") WHERE "status" = 'OPEN'`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_lost_reports_user" ON "tb_lost_reports" ("idtb_users", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_lost_reports"`);
  }
}
