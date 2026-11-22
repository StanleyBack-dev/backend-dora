import type { MigrationInterface, QueryRunner } from "typeorm";

// Purchases: where a request's purchase will be used may be one of the
// condominium's spaces (Gestão > Espaços, the base registry, not the
// bookings module). The space's name is also kept in "location", so the
// request still says where if the space is ever deleted; without a space,
// "location" is the place typed ("Outro local").
export class PurchaseRequestSpace1800000000033 implements MigrationInterface {
  name = "PurchaseRequestSpace1800000000033";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_purchase_requests"
        ADD COLUMN "idtb_spaces" uuid
          REFERENCES "tb_spaces" ("idtb_spaces") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_purchase_requests" DROP COLUMN "idtb_spaces"`,
    );
  }
}
