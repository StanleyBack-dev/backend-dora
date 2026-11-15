import type { MigrationInterface, QueryRunner } from "typeorm";

// "Apoie o Dora": the people who support the project and each contribution
// the platform administrator records (a static PIX code doesn't say who
// paid). Names are unique ignoring case, so a new contribution with a known
// name adds to that supporter.
export class Supporters1800000000009 implements MigrationInterface {
  name = "Supporters1800000000009";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_supporters" (
        "idtb_supporters" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(60) NOT NULL,
        "show_name" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_supporters_name" ON "tb_supporters" (lower("name"))`,
    );
    await queryRunner.query(`
      CREATE TABLE "tb_support_contributions" (
        "idtb_support_contributions" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_supporters" uuid NOT NULL
          REFERENCES "tb_supporters" ("idtb_supporters") ON DELETE CASCADE,
        "amount_cents" integer NOT NULL,
        "received_on" date NOT NULL,
        "note" varchar(200),
        "created_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_support_contributions_amount"
          CHECK ("amount_cents" > 0 AND "amount_cents" <= 10000000)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_support_contributions_supporter" ON "tb_support_contributions" ("idtb_supporters", "received_on")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_support_contributions"`);
    await queryRunner.query(`DROP TABLE "tb_supporters"`);
  }
}
