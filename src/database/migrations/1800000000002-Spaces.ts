import type { MigrationInterface, QueryRunner } from "typeorm";

// Bookable spaces of a condominium (courts, party room, barbecue…) with
// their booking rules. The rules are enforced by the bookings module.
export class Spaces1800000000002 implements MigrationInterface {
  name = "Spaces1800000000002";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_spaces" (
        "idtb_spaces" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "name" varchar(80) NOT NULL,
        "kind" varchar(16) NOT NULL
          CHECK ("kind" IN ('COURT', 'PARTY_ROOM', 'BARBECUE', 'POOL', 'GYM', 'GAME_ROOM', 'OTHER')),
        "description" varchar(1000),
        "capacity" int CHECK ("capacity" BETWEEN 1 AND 5000),
        "usage_rules" varchar(3000),
        "active" boolean NOT NULL DEFAULT true,
        -- [{ "weekday": 0-6, "opensAt": "HH:MM", "closesAt": "HH:MM" }]
        "opening_hours" jsonb NOT NULL DEFAULT '[]',
        "slot_minutes" int NOT NULL
          CHECK ("slot_minutes" BETWEEN 15 AND 1440 AND "slot_minutes" % 15 = 0),
        "min_advance_hours" int NOT NULL DEFAULT 0
          CHECK ("min_advance_hours" BETWEEN 0 AND 720),
        "max_advance_days" int NOT NULL DEFAULT 30
          CHECK ("max_advance_days" BETWEEN 1 AND 365),
        "unit_limit_count" int CHECK ("unit_limit_count" BETWEEN 1 AND 100),
        "unit_limit_period" varchar(5)
          CHECK ("unit_limit_period" IN ('DAY', 'WEEK', 'MONTH')),
        "requires_approval" boolean NOT NULL DEFAULT false,
        "cancel_until_hours" int NOT NULL DEFAULT 0
          CHECK ("cancel_until_hours" BETWEEN 0 AND 720),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CHECK (("unit_limit_count" IS NULL) = ("unit_limit_period" IS NULL))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_spaces_condominium_name" ON "tb_spaces" ("idtb_condominiums", lower("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_spaces"`);
  }
}
