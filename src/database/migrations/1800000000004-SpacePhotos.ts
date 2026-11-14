import type { MigrationInterface, QueryRunner } from "typeorm";

// Up to 3 photos per space: [{ "id": uuid, "key": object storage key }].
// The files live in the object storage; the database keeps their keys.
export class SpacePhotos1800000000004 implements MigrationInterface {
  name = "SpacePhotos1800000000004";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_spaces"
        ADD COLUMN "photos" jsonb NOT NULL DEFAULT '[]',
        ADD CONSTRAINT "ck_spaces_photos" CHECK (
          jsonb_typeof("photos") = 'array' AND jsonb_array_length("photos") <= 3
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_spaces" DROP CONSTRAINT "ck_spaces_photos", DROP COLUMN "photos"`,
    );
  }
}
