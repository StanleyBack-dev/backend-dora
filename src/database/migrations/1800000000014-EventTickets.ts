import type { MigrationInterface, QueryRunner } from "typeorm";

// Events, stage 2: tickets and PIX.
// - tb_condominium_pix: the condominium's PIX (key type, key, receiver name
//   and city), set by its managers; ticketed events use it unless they have
//   their own.
// - tb_events: the full price (inteira), the optional limit of tickets per
//   unit and which PIX receives (CONDOMINIUM, or CUSTOM with the event's own
//   key, name and city).
// - tb_event_ticket_types: the audiences accepted, from a fixed list (once
//   per event): what each pays (full, half, free or its own value) and an
//   optional age range.
// - tb_event_orders: a member's order (code = PIX reference, total, the PIX
//   used, the 48 h hold, the receipt and the managers' review).
// - tb_event_attendees: the people of an order (name, age, from outside,
//   the ticket type with its name and price as they were when ordered).
export class EventTickets1800000000014 implements MigrationInterface {
  name = "EventTickets1800000000014";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_condominium_pix" (
        "idtb_condominiums" uuid PRIMARY KEY
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "key_type" varchar(6) NOT NULL
          CHECK ("key_type" IN ('CPF', 'CNPJ', 'PHONE', 'EMAIL', 'RANDOM')),
        "pix_key" varchar(77) NOT NULL,
        "receiver_name" varchar(25) NOT NULL,
        "receiver_city" varchar(15) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "tb_events"
        ADD COLUMN "full_price_cents" integer
          CHECK ("full_price_cents" BETWEEN 1 AND 10000000),
        ADD COLUMN "unit_ticket_limit" integer
          CHECK ("unit_ticket_limit" BETWEEN 1 AND 1000),
        ADD COLUMN "pix_source" varchar(12)
          CHECK ("pix_source" IN ('CONDOMINIUM', 'CUSTOM')),
        ADD COLUMN "pix_key_type" varchar(6)
          CHECK ("pix_key_type" IN ('CPF', 'CNPJ', 'PHONE', 'EMAIL', 'RANDOM')),
        ADD COLUMN "pix_key" varchar(77),
        ADD COLUMN "pix_receiver_name" varchar(25),
        ADD COLUMN "pix_receiver_city" varchar(15),
        ADD CONSTRAINT "ck_events_custom_pix" CHECK (
          (coalesce("pix_source", '') = 'CUSTOM') =
          ("pix_key_type" IS NOT NULL AND "pix_key" IS NOT NULL
           AND "pix_receiver_name" IS NOT NULL
           AND "pix_receiver_city" IS NOT NULL)
        )
    `);

    await queryRunner.query(`
      CREATE TABLE "tb_event_ticket_types" (
        "idtb_event_ticket_types" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_events" uuid NOT NULL
          REFERENCES "tb_events" ("idtb_events") ON DELETE CASCADE,
        "kind" varchar(10) NOT NULL CHECK ("kind" IN (
          'ADULT', 'CHILD', 'INFANT', 'SENIOR', 'STUDENT', 'PCD', 'TEACHER')),
        "price_mode" varchar(6) NOT NULL
          CHECK ("price_mode" IN ('FULL', 'HALF', 'FREE', 'CUSTOM')),
        "custom_price_cents" integer
          CHECK ("custom_price_cents" BETWEEN 0 AND 10000000),
        CONSTRAINT "ck_event_ticket_types_custom" CHECK (
          ("price_mode" = 'CUSTOM') = ("custom_price_cents" IS NOT NULL)
        ),
        "min_age" smallint CHECK ("min_age" BETWEEN 0 AND 120),
        "max_age" smallint CHECK ("max_age" BETWEEN 0 AND 120),
        "position" smallint NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_event_ticket_types_ages"
          CHECK ("min_age" IS NULL OR "max_age" IS NULL OR "min_age" <= "max_age"),
        -- Checked at commit: kinds may swap between kept types in one save.
        CONSTRAINT "uq_event_ticket_types_kind" UNIQUE ("idtb_events", "kind")
          DEFERRABLE INITIALLY DEFERRED
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_event_ticket_types_event" ON "tb_event_ticket_types" ("idtb_events", "position")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_event_orders" (
        "idtb_event_orders" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "idtb_events" uuid NOT NULL
          REFERENCES "tb_events" ("idtb_events") ON DELETE CASCADE,
        "idtb_users" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "idtb_units" uuid
          REFERENCES "tb_units" ("idtb_units") ON DELETE SET NULL,
        "code" varchar(8) NOT NULL UNIQUE,
        "status" varchar(16) NOT NULL CHECK ("status" IN (
          'PENDING_PAYMENT', 'AWAITING_REVIEW', 'CONFIRMED', 'REJECTED',
          'EXPIRED', 'CANCELLED')),
        "total_cents" integer NOT NULL CHECK ("total_cents" >= 0),
        "pix_key_type" varchar(6),
        "pix_key" varchar(77),
        "pix_receiver_name" varchar(25),
        "pix_receiver_city" varchar(15),
        "expires_at" timestamptz,
        "receipt_key" varchar(300),
        "receipt_content_type" varchar(40),
        "receipt_sent_at" timestamptz,
        "reviewed_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "reject_reason" varchar(300),
        "cancelled_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_event_orders_paid_pix" CHECK (
          "total_cents" = 0 OR "pix_key" IS NOT NULL
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_event_orders_event" ON "tb_event_orders" ("idtb_events", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_event_orders_user" ON "tb_event_orders" ("idtb_users", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_event_attendees" (
        "idtb_event_attendees" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_event_orders" uuid NOT NULL
          REFERENCES "tb_event_orders" ("idtb_event_orders") ON DELETE CASCADE,
        "idtb_event_ticket_types" uuid
          REFERENCES "tb_event_ticket_types" ("idtb_event_ticket_types")
          ON DELETE SET NULL,
        "ticket_name" varchar(60),
        "name" varchar(80) NOT NULL,
        "age" smallint NOT NULL CHECK ("age" BETWEEN 0 AND 120),
        "outside" boolean NOT NULL DEFAULT false,
        "price_cents" integer NOT NULL CHECK ("price_cents" >= 0),
        "position" smallint NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_event_attendees_order" ON "tb_event_attendees" ("idtb_event_orders", "position")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_event_attendees"`);
    await queryRunner.query(`DROP TABLE "tb_event_orders"`);
    await queryRunner.query(`DROP TABLE "tb_event_ticket_types"`);
    await queryRunner.query(`
      ALTER TABLE "tb_events"
        DROP CONSTRAINT "ck_events_custom_pix",
        DROP COLUMN "pix_receiver_city",
        DROP COLUMN "pix_receiver_name",
        DROP COLUMN "pix_key",
        DROP COLUMN "pix_key_type",
        DROP COLUMN "pix_source",
        DROP COLUMN "unit_ticket_limit",
        DROP COLUMN "full_price_cents"
    `);
    await queryRunner.query(`DROP TABLE "tb_condominium_pix"`);
  }
}
