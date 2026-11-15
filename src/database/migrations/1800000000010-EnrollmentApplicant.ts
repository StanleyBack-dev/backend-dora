import type { MigrationInterface, QueryRunner } from "typeorm";

// The public sign-up asks whether the person lives in the condominium or
// works there. Employees send no unit nor address. Requests sent before
// this were all from residents.
export class EnrollmentApplicant1800000000010 implements MigrationInterface {
  name = "EnrollmentApplicant1800000000010";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_requests"
        ADD COLUMN "applicant" varchar(10) NOT NULL DEFAULT 'RESIDENT',
        ADD CONSTRAINT "ck_enrollment_requests_applicant"
          CHECK ("applicant" IN ('RESIDENT', 'EMPLOYEE'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_requests"
        DROP CONSTRAINT "ck_enrollment_requests_applicant",
        DROP COLUMN "applicant"
    `);
  }
}
