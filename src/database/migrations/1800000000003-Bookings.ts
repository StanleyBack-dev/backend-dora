import type { MigrationInterface, QueryRunner } from "typeorm";

// Bookings of spaces and the periods a space is blocked. The database itself
// guarantees that two active bookings of the same space never overlap
// (exclusion constraint), so simultaneous requests can't double-book.
export class Bookings1800000000003 implements MigrationInterface {
  name = "Bookings1800000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Lets the exclusion constraint combine "same space" (=) with "overlapping
    // period" (&&) in one GiST index.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await queryRunner.query(`
      CREATE TABLE "tb_bookings" (
        "idtb_bookings" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        -- A space with bookings is deactivated, never deleted (history).
        -- NO ACTION (checked at the end of the statement) still blocks
        -- deleting such a space, but lets a condominium cascade to both.
        "idtb_spaces" uuid NOT NULL
          REFERENCES "tb_spaces" ("idtb_spaces") ON DELETE NO ACTION,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "idtb_units" uuid REFERENCES "tb_units" ("idtb_units") ON DELETE SET NULL,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "status" varchar(10) NOT NULL
          CHECK ("status" IN ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
        "notes" varchar(300),
        "cancel_until" timestamptz NOT NULL,
        "decided_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "decided_at" timestamptz,
        "reason" varchar(300),
        "cancelled_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "ex_bookings_no_overlap" EXCLUDE USING gist (
          "idtb_spaces" WITH =,
          tstzrange("starts_at", "ends_at") WITH &&
        ) WHERE ("status" IN ('PENDING', 'CONFIRMED'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_bookings_condominium_starts" ON "tb_bookings" ("idtb_condominiums", "starts_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_bookings_user_starts" ON "tb_bookings" ("idtb_users", "starts_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_bookings_unit_space_starts" ON "tb_bookings" ("idtb_units", "idtb_spaces", "starts_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_space_blocks" (
        "idtb_space_blocks" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "idtb_spaces" uuid NOT NULL
          REFERENCES "tb_spaces" ("idtb_spaces") ON DELETE CASCADE,
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "reason" varchar(200) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CHECK ("ends_at" > "starts_at")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_space_blocks_space_period" ON "tb_space_blocks" USING gist ("idtb_spaces", tstzrange("starts_at", "ends_at"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_space_blocks"`);
    await queryRunner.query(`DROP TABLE "tb_bookings"`);
  }
}
