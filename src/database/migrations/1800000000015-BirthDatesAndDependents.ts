import type { MigrationInterface, QueryRunner } from "typeorm";

// Birth dates and dependents, so event tickets are priced by a known age.
// - tb_users.birth_date: the person's own (sign-up, profile, managers).
// - tb_enrollment_requests.birth_date: asked on the public sign-up (null on
//   requests sent before this).
// - tb_dependents: people of a resident's household who don't use the app
//   (children…), with a document proving the birth date; the managers
//   approve each one once and it serves every event.
// - tb_event_attendees: who each person is (the buyer, a dependent or
//   someone else) and the document a discounted ticket needs when the age
//   or the condition (student, PcD, teacher) isn't known by the app.
export class BirthDatesAndDependents1800000000015 implements MigrationInterface {
  name = "BirthDatesAndDependents1800000000015";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_users" ADD COLUMN "birth_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_enrollment_requests" ADD COLUMN "birth_date" date`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_dependents" (
        "idtb_dependents" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "idtb_memberships" uuid NOT NULL
          REFERENCES "tb_memberships" ("idtb_memberships") ON DELETE CASCADE,
        "name" varchar(80) NOT NULL,
        "birth_date" date NOT NULL,
        "relationship" varchar(12) NOT NULL CHECK ("relationship" IN (
          'CHILD', 'SPOUSE', 'PARENT', 'SIBLING', 'GRANDCHILD', 'OTHER')),
        "document_key" varchar(300) NOT NULL,
        "document_content_type" varchar(40) NOT NULL,
        "status" varchar(10) NOT NULL DEFAULT 'PENDING'
          CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED')),
        "reviewed_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "reject_reason" varchar(300),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_dependents_membership" ON "tb_dependents" ("idtb_memberships")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_dependents_condominium" ON "tb_dependents" ("idtb_condominiums", "status")`,
    );

    await queryRunner.query(`
      ALTER TABLE "tb_event_attendees"
        ADD COLUMN "source" varchar(9) NOT NULL DEFAULT 'GUEST'
          CHECK ("source" IN ('SELF', 'DEPENDENT', 'GUEST')),
        ADD COLUMN "idtb_dependents" uuid
          REFERENCES "tb_dependents" ("idtb_dependents") ON DELETE SET NULL,
        ADD COLUMN "needs_proof" boolean NOT NULL DEFAULT false,
        ADD COLUMN "proof_key" varchar(300),
        ADD COLUMN "proof_content_type" varchar(40)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_event_attendees"
        DROP COLUMN "proof_content_type",
        DROP COLUMN "proof_key",
        DROP COLUMN "needs_proof",
        DROP COLUMN "idtb_dependents",
        DROP COLUMN "source"
    `);
    await queryRunner.query(`DROP TABLE "tb_dependents"`);
    await queryRunner.query(
      `ALTER TABLE "tb_enrollment_requests" DROP COLUMN "birth_date"`,
    );
    await queryRunner.query(`ALTER TABLE "tb_users" DROP COLUMN "birth_date"`);
  }
}
