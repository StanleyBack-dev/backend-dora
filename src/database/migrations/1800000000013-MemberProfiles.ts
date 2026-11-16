import type { MigrationInterface, QueryRunner } from "typeorm";

// A membership is now either a resident's or an employee's (its `kind`),
// apart from the role (permissions only). The resident data (unit and
// complement) moves to tb_residents; employees get their own record in
// tb_employees (job title, hiring date, shift, outsourcing company), the
// base for a future time sheet. The composite FK (membership, kind) keeps a
// membership from having the other kind's record.
//
// Existing members: the concierge, and managers with no unit, become
// employees; everyone else stays a resident.
export class MemberProfiles1800000000013 implements MigrationInterface {
  name = "MemberProfiles1800000000013";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_memberships"
        ADD COLUMN "kind" varchar(10) NOT NULL DEFAULT 'RESIDENT',
        ADD CONSTRAINT "ck_memberships_kind"
          CHECK ("kind" IN ('RESIDENT', 'EMPLOYEE')),
        ADD CONSTRAINT "uq_memberships_id_kind"
          UNIQUE ("idtb_memberships", "kind")
    `);
    await queryRunner.query(`
      UPDATE "tb_memberships" SET "kind" = 'EMPLOYEE'
       WHERE "role" = 'CONCIERGE'
          OR ("role" = 'ADMIN' AND "idtb_units" IS NULL)
    `);

    await queryRunner.query(`
      CREATE TABLE "tb_residents" (
        "idtb_memberships" uuid PRIMARY KEY,
        "kind" varchar(10) NOT NULL DEFAULT 'RESIDENT'
          CHECK ("kind" = 'RESIDENT'),
        "idtb_units" uuid
          REFERENCES "tb_units" ("idtb_units") ON DELETE SET NULL,
        "unit_complement" varchar(80),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_residents_membership"
          FOREIGN KEY ("idtb_memberships", "kind")
          REFERENCES "tb_memberships" ("idtb_memberships", "kind")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_residents_unit" ON "tb_residents" ("idtb_units")`,
    );
    await queryRunner.query(`
      CREATE TABLE "tb_employees" (
        "idtb_memberships" uuid PRIMARY KEY,
        "kind" varchar(10) NOT NULL DEFAULT 'EMPLOYEE'
          CHECK ("kind" = 'EMPLOYEE'),
        "job_title" varchar(60),
        "hired_on" date,
        "work_shift" varchar(80),
        "contractor" varchar(120),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_employees_membership"
          FOREIGN KEY ("idtb_memberships", "kind")
          REFERENCES "tb_memberships" ("idtb_memberships", "kind")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "tb_residents" ("idtb_memberships", "idtb_units", "unit_complement")
      SELECT "idtb_memberships", "idtb_units", "unit_complement"
        FROM "tb_memberships" WHERE "kind" = 'RESIDENT'
    `);
    await queryRunner.query(`
      INSERT INTO "tb_employees" ("idtb_memberships")
      SELECT "idtb_memberships" FROM "tb_memberships" WHERE "kind" = 'EMPLOYEE'
    `);

    await queryRunner.query(`DROP INDEX "ix_memberships_unit"`);
    await queryRunner.query(`
      ALTER TABLE "tb_memberships"
        DROP COLUMN "idtb_units",
        DROP COLUMN "unit_complement"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_memberships"
        ADD COLUMN "idtb_units" uuid
          REFERENCES "tb_units" ("idtb_units") ON DELETE SET NULL,
        ADD COLUMN "unit_complement" varchar(80)
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_memberships_unit" ON "tb_memberships" ("idtb_units")`,
    );
    await queryRunner.query(`
      UPDATE "tb_memberships" m
         SET "idtb_units" = r."idtb_units",
             "unit_complement" = r."unit_complement"
        FROM "tb_residents" r
       WHERE r."idtb_memberships" = m."idtb_memberships"
    `);
    await queryRunner.query(`DROP TABLE "tb_employees"`);
    await queryRunner.query(`DROP TABLE "tb_residents"`);
    await queryRunner.query(`
      ALTER TABLE "tb_memberships"
        DROP CONSTRAINT "uq_memberships_id_kind",
        DROP CONSTRAINT "ck_memberships_kind",
        DROP COLUMN "kind"
    `);
  }
}
