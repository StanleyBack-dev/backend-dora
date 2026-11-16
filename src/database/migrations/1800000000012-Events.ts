import type { MigrationInterface, QueryRunner } from "typeorm";

// Optional modules contracted apart per condominium (the platform turns
// them on), and the first of them: condominium events. An event happens in a
// space of the condominium or outside it (with the full address), has a
// period, a capacity and a limit of guests from outside (0: residents only),
// and is entered with a ticket (paid by PIX or free; tickets come in the next
// stage).
export class Events1800000000012 implements MigrationInterface {
  name = "Events1800000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_condominium_modules" (
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "module" varchar(30) NOT NULL,
        "enabled_at" timestamptz NOT NULL DEFAULT now(),
        "enabled_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        PRIMARY KEY ("idtb_condominiums", "module"),
        CONSTRAINT "ck_condominium_modules_module" CHECK ("module" IN ('EVENTS'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tb_events" (
        "idtb_events" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "title" varchar(120) NOT NULL,
        "description" varchar(4000),
        "idtb_spaces" uuid
          REFERENCES "tb_spaces" ("idtb_spaces") ON DELETE SET NULL,
        "location" varchar(120),
        "address_zip" char(8),
        "address_street" varchar(120),
        "address_number" varchar(10),
        "address_complement" varchar(80),
        "address_district" varchar(80),
        "address_city" varchar(80),
        "address_state" char(2),
        "starts_at" timestamptz NOT NULL,
        "ends_at" timestamptz NOT NULL,
        "capacity" integer NOT NULL,
        "external_guest_limit" integer NOT NULL DEFAULT 0,
        "ticketed" boolean NOT NULL DEFAULT false,
        "status" varchar(10) NOT NULL DEFAULT 'DRAFT',
        "cancel_reason" varchar(400),
        "published_at" timestamptz,
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CONSTRAINT "ck_events_status"
          CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'CANCELLED')),
        CONSTRAINT "ck_events_period" CHECK ("ends_at" > "starts_at"),
        CONSTRAINT "ck_events_capacity" CHECK ("capacity" > 0),
        CONSTRAINT "ck_events_guests" CHECK (
          "external_guest_limit" >= 0 AND "external_guest_limit" <= "capacity"
        ),
        CONSTRAINT "ck_events_address" CHECK (
          ("address_zip" IS NULL AND "address_street" IS NULL
            AND "address_number" IS NULL AND "address_district" IS NULL
            AND "address_city" IS NULL AND "address_state" IS NULL)
          OR ("address_zip" ~ '^[0-9]{8}$' AND "address_street" IS NOT NULL
            AND "address_number" IS NOT NULL AND "address_district" IS NOT NULL
            AND "address_city" IS NOT NULL AND "address_state" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_events_condominium_starts" ON "tb_events" ("idtb_condominiums", "starts_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_events"`);
    await queryRunner.query(`DROP TABLE "tb_condominium_modules"`);
  }
}
