import type { MigrationInterface, QueryRunner } from "typeorm";

// Parcels (encomendas), a module contracted apart (AppModule.PARCELS):
// - tb_parcels: a parcel the gate (Portaria) received for a unit (who it is
//   for, carrier, tracking code, where it is kept, an optional photo), the
//   pickup code residents show (typed or as a QR) and how it ended (picked
//   up, returned to the sender or cancelled: registered by mistake).
// - tb_parcel_signatures: the handwritten electronic signature of whoever
//   picked it up, drawn on the gate's screen, with the evidence that backs
//   it: the declaration shown, the strokes (time and pressure of each point),
//   the image, server and device time, IP, browser, device, location (when
//   allowed), the staff member and session, and a SHA-256 digest of it all.
//   Written once, never changed (a trigger refuses updates).
export class ParcelsModule1800000000020 implements MigrationInterface {
  name = "ParcelsModule1800000000020";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_condominium_modules"
        DROP CONSTRAINT "ck_condominium_modules_module",
        ADD CONSTRAINT "ck_condominium_modules_module"
          CHECK ("module" IN ('EVENTS', 'BOOKINGS', 'PARCELS'))`);

    await queryRunner.query(`
      CREATE TABLE "tb_parcels" (
        "idtb_parcels" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "idtb_units" uuid
          REFERENCES "tb_units" ("idtb_units") ON DELETE SET NULL,
        "recipient_name" varchar(120),
        "carrier" varchar(60),
        "tracking_code" varchar(60),
        "notes" varchar(300),
        "storage_location" varchar(60),
        "photo_key" varchar(300),
        "pickup_code" varchar(6) NOT NULL UNIQUE,
        "status" varchar(10) NOT NULL DEFAULT 'RECEIVED'
          CHECK ("status" IN ('RECEIVED', 'PICKED_UP', 'RETURNED', 'CANCELLED')),
        "received_at" timestamptz NOT NULL,
        "received_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "closed_at" timestamptz,
        "closed_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "close_reason" varchar(300),
        "reminded_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CONSTRAINT "ck_parcels_closed" CHECK (
          ("status" = 'RECEIVED') = ("closed_at" IS NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_parcels_condominium" ON "tb_parcels" ("idtb_condominiums", "status", "received_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_parcels_unit" ON "tb_parcels" ("idtb_units", "received_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_parcel_signatures" (
        "idtb_parcels" uuid PRIMARY KEY
          REFERENCES "tb_parcels" ("idtb_parcels") ON DELETE CASCADE,
        "signer_name" varchar(120) NOT NULL,
        "signer_document_type" varchar(3)
          CHECK ("signer_document_type" IN ('CPF', 'RG')),
        "signer_document" varchar(14),
        "declaration" varchar(1000) NOT NULL,
        "image_key" varchar(300) NOT NULL,
        "image_sha256" char(64) NOT NULL,
        "strokes" jsonb NOT NULL,
        "strokes_sha256" char(64) NOT NULL,
        "signed_at" timestamptz NOT NULL,
        "client_signed_at" timestamptz,
        "client_time_zone" varchar(64),
        "ip_address" varchar(64),
        "user_agent" varchar(400),
        "device" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "location_status" varchar(11) NOT NULL
          CHECK ("location_status" IN ('GRANTED', 'DENIED', 'UNAVAILABLE')),
        "latitude" numeric(9, 6) CHECK ("latitude" BETWEEN -90 AND 90),
        "longitude" numeric(9, 6) CHECK ("longitude" BETWEEN -180 AND 180),
        "location_accuracy_m" numeric(9, 1) CHECK ("location_accuracy_m" >= 0),
        -- No foreign keys below: the row never changes (ON DELETE SET NULL
        -- would be an update), and the evidence keeps every id as signed.
        "collected_by" uuid NOT NULL,
        "collected_by_name" varchar(120) NOT NULL,
        -- Who handed it over: the gate (CONCIERGE) or the administration (ADMIN…).
        "collected_by_role" varchar(12) NOT NULL,
        "session_id" uuid,
        -- Everything the digest covers, as signed (canonical JSON).
        "evidence" jsonb NOT NULL,
        "evidence_sha256" char(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_parcel_signatures_document" CHECK (
          ("signer_document_type" IS NULL) = ("signer_document" IS NULL)
        ),
        CONSTRAINT "ck_parcel_signatures_location" CHECK (
          ("location_status" = 'GRANTED') =
          ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)
        )
      )
    `);
    // A signature is evidence: once written it never changes.
    await queryRunner.query(`
      CREATE FUNCTION "fn_parcel_signatures_immutable"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'tb_parcel_signatures is append-only';
      END;
      $$`);
    await queryRunner.query(`
      CREATE TRIGGER "tg_parcel_signatures_immutable"
        BEFORE UPDATE ON "tb_parcel_signatures"
        FOR EACH ROW EXECUTE FUNCTION "fn_parcel_signatures_immutable"()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_parcel_signatures"`);
    await queryRunner.query(`DROP FUNCTION "fn_parcel_signatures_immutable"()`);
    await queryRunner.query(`DROP TABLE "tb_parcels"`);
    await queryRunner.query(
      `DELETE FROM "tb_condominium_modules" WHERE "module" = 'PARCELS'`,
    );
    await queryRunner.query(`
      ALTER TABLE "tb_condominium_modules"
        DROP CONSTRAINT "ck_condominium_modules_module",
        ADD CONSTRAINT "ck_condominium_modules_module"
          CHECK ("module" IN ('EVENTS', 'BOOKINGS'))`);
  }
}
