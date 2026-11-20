import type { MigrationInterface, QueryRunner } from "typeorm";

// Pickup by someone else: while a parcel waits, a resident who sees it can
// authorize one person (name and, optionally, CPF or RG). The desk sees who
// it is when the code is read; the authorization goes into the signature's
// evidence. Cleared or replaced only while the parcel waits.
export class ParcelAuthorizedPickup1800000000023 implements MigrationInterface {
  name = "ParcelAuthorizedPickup1800000000023";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_parcels"
        ADD COLUMN "authorized_name" varchar(120),
        ADD COLUMN "authorized_document_type" varchar(3)
          CHECK ("authorized_document_type" IN ('CPF', 'RG')),
        ADD COLUMN "authorized_document" varchar(14),
        ADD COLUMN "authorized_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        ADD COLUMN "authorized_at" timestamptz,
        ADD CONSTRAINT "ck_parcels_authorized"
          CHECK (("authorized_name" IS NULL) = ("authorized_at" IS NULL)),
        ADD CONSTRAINT "ck_parcels_authorized_document"
          CHECK (("authorized_document" IS NULL) = ("authorized_document_type" IS NULL))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_parcels"
        DROP CONSTRAINT "ck_parcels_authorized_document",
        DROP CONSTRAINT "ck_parcels_authorized",
        DROP COLUMN "authorized_at",
        DROP COLUMN "authorized_by",
        DROP COLUMN "authorized_document",
        DROP COLUMN "authorized_document_type",
        DROP COLUMN "authorized_name"`);
  }
}
