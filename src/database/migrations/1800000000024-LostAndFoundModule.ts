import type { MigrationInterface, QueryRunner } from "typeorm";

// Lost and found (achados e perdidos), a module contracted apart
// (AppModule.LOST_AND_FOUND):
// - tb_found_items: something found in the condominium and kept by the gate
//   or the administration (category, what it is, where and when it was
//   found, where it is kept, a photo, details only the staff sees to check
//   the owner), until it is returned, donated or discarded. It is kept for
//   a period (keep_until); the staff is told before it ends.
// - tb_found_item_claims: a resident says "it's mine", describing it; the
//   staff accepts or rejects (with a note).
// - tb_found_item_returns: the handwritten electronic signature of whoever
//   takes it back, with the same evidence as a parcel pickup and a SHA-256
//   digest of it all. Written once, never changed (a trigger refuses
//   updates).
export class LostAndFoundModule1800000000024 implements MigrationInterface {
  name = "LostAndFoundModule1800000000024";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_condominium_modules"
        DROP CONSTRAINT "ck_condominium_modules_module",
        ADD CONSTRAINT "ck_condominium_modules_module"
          CHECK ("module" IN ('EVENTS', 'BOOKINGS', 'PARCELS', 'LOST_AND_FOUND'))`);

    await queryRunner.query(`
      CREATE TABLE "tb_found_items" (
        "idtb_found_items" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "category" varchar(12) NOT NULL
          CHECK ("category" IN ('DOCUMENT', 'KEYS', 'ELECTRONICS', 'CLOTHING',
                                'ACCESSORY', 'BAG', 'TOY', 'OTHER')),
        "title" varchar(80) NOT NULL,
        "description" varchar(300),
        "private_details" varchar(300),
        "found_location" varchar(80) NOT NULL,
        "found_at" timestamptz NOT NULL,
        "storage_location" varchar(60) NOT NULL,
        "photo_key" varchar(300),
        "photo_hidden" boolean NOT NULL DEFAULT false,
        "status" varchar(10) NOT NULL DEFAULT 'FOUND'
          CHECK ("status" IN ('FOUND', 'RETURNED', 'DONATED', 'DISCARDED')),
        "registered_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "keep_until" timestamptz NOT NULL,
        "expiry_notified_at" timestamptz,
        "closed_at" timestamptz,
        "closed_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "close_reason" varchar(300),
        "returned_to" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CONSTRAINT "ck_found_items_closed" CHECK (
          ("status" = 'FOUND') = ("closed_at" IS NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_found_items_condominium" ON "tb_found_items" ("idtb_condominiums", "status", "found_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_found_items_keep_until" ON "tb_found_items" ("keep_until") WHERE "status" = 'FOUND'`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_found_item_claims" (
        "idtb_found_item_claims" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_found_items" uuid NOT NULL
          REFERENCES "tb_found_items" ("idtb_found_items") ON DELETE CASCADE,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "message" varchar(500) NOT NULL,
        "status" varchar(9) NOT NULL DEFAULT 'PENDING'
          CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
        "decided_at" timestamptz,
        "decided_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "decision_note" varchar(300),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    // One open claim (pending or accepted) per person and item.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_found_item_claims_open" ON "tb_found_item_claims" ("idtb_found_items", "idtb_users") WHERE "status" IN ('PENDING', 'ACCEPTED')`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_found_item_claims_user" ON "tb_found_item_claims" ("idtb_users", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_found_item_returns" (
        "idtb_found_items" uuid PRIMARY KEY
          REFERENCES "tb_found_items" ("idtb_found_items") ON DELETE CASCADE,
        -- No foreign keys below: the row never changes (ON DELETE SET NULL
        -- would be an update), and the evidence keeps every id as signed.
        "claim_id" uuid,
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
        "collected_by" uuid NOT NULL,
        "collected_by_name" varchar(120) NOT NULL,
        "collected_by_role" varchar(12) NOT NULL,
        "session_id" uuid,
        "evidence" jsonb NOT NULL,
        "evidence_sha256" char(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_found_item_returns_document" CHECK (
          ("signer_document_type" IS NULL) = ("signer_document" IS NULL)
        ),
        CONSTRAINT "ck_found_item_returns_location" CHECK (
          ("location_status" = 'GRANTED') =
          ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)
        )
      )
    `);
    // A signature is evidence: once written it never changes.
    await queryRunner.query(`
      CREATE FUNCTION "fn_found_item_returns_immutable"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'tb_found_item_returns is append-only';
      END;
      $$`);
    await queryRunner.query(`
      CREATE TRIGGER "tg_found_item_returns_immutable"
        BEFORE UPDATE ON "tb_found_item_returns"
        FOR EACH ROW EXECUTE FUNCTION "fn_found_item_returns_immutable"()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_found_item_returns"`);
    await queryRunner.query(
      `DROP FUNCTION "fn_found_item_returns_immutable"()`,
    );
    await queryRunner.query(`DROP TABLE "tb_found_item_claims"`);
    await queryRunner.query(`DROP TABLE "tb_found_items"`);
    await queryRunner.query(
      `DELETE FROM "tb_condominium_modules" WHERE "module" = 'LOST_AND_FOUND'`,
    );
    await queryRunner.query(`
      ALTER TABLE "tb_condominium_modules"
        DROP CONSTRAINT "ck_condominium_modules_module",
        ADD CONSTRAINT "ck_condominium_modules_module"
          CHECK ("module" IN ('EVENTS', 'BOOKINGS', 'PARCELS'))`);
  }
}
