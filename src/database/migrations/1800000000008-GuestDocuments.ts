import type { MigrationInterface, QueryRunner } from "typeorm";

// A guest's document is a CPF or an RG, stored as digits (an RG may end in
// "X") with its type; the database refuses anything else. Documents typed
// before this rule that don't fit either shape are dropped (they were free
// text and can't be trusted at the gate).
export class GuestDocuments1800000000008 implements MigrationInterface {
  name = "GuestDocuments1800000000008";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_booking_guests"
        ADD COLUMN "document_type" varchar(3)
    `);
    await queryRunner.query(`
      UPDATE "tb_booking_guests"
         SET "document" = regexp_replace("document", '[^0-9]', '', 'g'),
             "document_type" = 'CPF'
       WHERE "document" ~ '^[0-9.\\- ]+$'
         AND length(regexp_replace("document", '[^0-9]', '', 'g')) = 11
    `);
    await queryRunner.query(`
      UPDATE "tb_booking_guests"
         SET "document" = upper(regexp_replace("document", '[^0-9xX]', '', 'g')),
             "document_type" = 'RG'
       WHERE "document_type" IS NULL
         AND upper(regexp_replace("document", '[^0-9xX]', '', 'g')) ~ '^[0-9]{6,9}[0-9X]$'
    `);
    await queryRunner.query(`
      UPDATE "tb_booking_guests" SET "document" = NULL
       WHERE "document_type" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_booking_guests"
        ADD CONSTRAINT "ck_booking_guests_document" CHECK (
          ("document" IS NULL AND "document_type" IS NULL)
          OR ("document_type" = 'CPF' AND "document" ~ '^[0-9]{11}$')
          OR ("document_type" = 'RG' AND "document" ~ '^[0-9]{6,9}[0-9X]$')
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_booking_guests" DROP CONSTRAINT "ck_booking_guests_document"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_booking_guests" DROP COLUMN "document_type"`,
    );
  }
}
