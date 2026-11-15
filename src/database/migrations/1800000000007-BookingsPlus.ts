import type { MigrationInterface, QueryRunner } from "typeorm";

// Bookings, second round:
// - spaces: an optional usage fee, guest rules and whether residents may
//   book weekly series;
// - bookings: the fee as it was when booking (and when it went to the
//   condominium's billing) and the series a booking belongs to;
// - guests of a booking, with the code the gate (Portaria) checks in;
// - the waiting list of a taken slot;
// - the Portaria role (CONCIERGE) on memberships and broadcasts.
export class BookingsPlus1800000000007 implements MigrationInterface {
  name = "BookingsPlus1800000000007";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_spaces"
        ADD COLUMN "fee_cents" int
          CHECK ("fee_cents" BETWEEN 1 AND 10000000),
        ADD COLUMN "guests_allowed" boolean NOT NULL DEFAULT false,
        ADD COLUMN "max_guests" int CHECK ("max_guests" BETWEEN 1 AND 500),
        ADD COLUMN "guest_document_required" boolean NOT NULL DEFAULT false,
        ADD COLUMN "recurring_allowed" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "tb_bookings"
        ADD COLUMN "fee_cents" int CHECK ("fee_cents" >= 0),
        ADD COLUMN "fee_billed_at" timestamptz,
        ADD COLUMN "fee_billed_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        ADD COLUMN "series_id" uuid
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_bookings_series" ON "tb_bookings" ("series_id") WHERE "series_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_bookings_fees" ON "tb_bookings" ("idtb_condominiums", "starts_at") WHERE "fee_cents" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_booking_guests" (
        "idtb_booking_guests" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_bookings" uuid NOT NULL
          REFERENCES "tb_bookings" ("idtb_bookings") ON DELETE CASCADE,
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "document" varchar(30),
        "phone" varchar(11) CHECK ("phone" ~ '^[0-9]{10,11}$'),
        -- What the invite's QR code carries and the gate types or scans.
        "code" varchar(12) NOT NULL UNIQUE,
        "checked_in_at" timestamptz,
        "checked_in_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_booking_guests_booking" ON "tb_booking_guests" ("idtb_bookings")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_booking_waitlist" (
        "idtb_booking_waitlist" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "idtb_spaces" uuid NOT NULL
          REFERENCES "tb_spaces" ("idtb_spaces") ON DELETE CASCADE,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "starts_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_booking_waitlist" UNIQUE ("idtb_spaces", "starts_at", "idtb_users")
      )
    `);

    // Portaria: a role inside a condominium, like resident and manager.
    await queryRunner.query(
      `ALTER TABLE "tb_memberships" DROP CONSTRAINT "tb_memberships_role_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_memberships" ADD CONSTRAINT "tb_memberships_role_check" CHECK ("role" IN ('USER', 'ADMIN', 'CONCIERGE'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" DROP CONSTRAINT "ck_broadcasts_target_group"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" ADD CONSTRAINT "ck_broadcasts_target_group" CHECK ("target_group" IN ('USER', 'ADMIN', 'CONCIERGE'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" DROP CONSTRAINT "ck_broadcasts_target_group"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" ADD CONSTRAINT "ck_broadcasts_target_group" CHECK ("target_group" IN ('USER', 'ADMIN'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_memberships" DROP CONSTRAINT "tb_memberships_role_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_memberships" ADD CONSTRAINT "tb_memberships_role_check" CHECK ("role" IN ('USER', 'ADMIN'))`,
    );
    await queryRunner.query(`DROP TABLE "tb_booking_waitlist"`);
    await queryRunner.query(`DROP TABLE "tb_booking_guests"`);
    await queryRunner.query(`DROP INDEX "ix_bookings_fees"`);
    await queryRunner.query(`DROP INDEX "ix_bookings_series"`);
    await queryRunner.query(`
      ALTER TABLE "tb_bookings"
        DROP COLUMN "series_id",
        DROP COLUMN "fee_billed_by",
        DROP COLUMN "fee_billed_at",
        DROP COLUMN "fee_cents"
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_spaces"
        DROP COLUMN "recurring_allowed",
        DROP COLUMN "guest_document_required",
        DROP COLUMN "max_guests",
        DROP COLUMN "guests_allowed",
        DROP COLUMN "fee_cents"
    `);
  }
}
