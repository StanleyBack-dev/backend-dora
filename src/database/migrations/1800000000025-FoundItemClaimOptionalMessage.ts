import type { MigrationInterface, QueryRunner } from "typeorm";

// Lost and found: "É meu" is one tap. The resident may add a description,
// but no longer has to: the desk checks the owner in person when the item
// is handed over (with the details only it knows, and the signature).
export class FoundItemClaimOptionalMessage1800000000025 implements MigrationInterface {
  name = "FoundItemClaimOptionalMessage1800000000025";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_found_item_claims" ALTER COLUMN "message" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "tb_found_item_claims" SET "message" = 'É meu.' WHERE "message" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_found_item_claims" ALTER COLUMN "message" SET NOT NULL`,
    );
  }
}
