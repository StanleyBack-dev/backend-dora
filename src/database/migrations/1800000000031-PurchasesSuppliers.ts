import type { MigrationInterface, QueryRunner } from "typeorm";

// Purchases (compras do condomínio), a module contracted apart
// (AppModule.PURCHASES). First, the suppliers: who the condominium buys
// from (CNPJ or CPF, name, the categories it serves, contact, city and
// PIX to pay it). "OTHER" among them comes with the text typed for it
// (category_other), so reports still group by category. A supplier
// is never deleted once used: it is deactivated, so the purchases keep
// their history.
export class PurchasesSuppliers1800000000031 implements MigrationInterface {
  name = "PurchasesSuppliers1800000000031";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_condominium_modules"
        DROP CONSTRAINT "ck_condominium_modules_module",
        ADD CONSTRAINT "ck_condominium_modules_module"
          CHECK ("module" IN ('EVENTS', 'BOOKINGS', 'PARCELS', 'LOST_AND_FOUND',
                              'PURCHASES'))`);

    await queryRunner.query(`
      CREATE TABLE "tb_suppliers" (
        "idtb_suppliers" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "document_type" varchar(4) NOT NULL
          CHECK ("document_type" IN ('CNPJ', 'CPF')),
        "document" varchar(14) NOT NULL,
        "name" varchar(120) NOT NULL,
        "trade_name" varchar(120),
        "categories" varchar(12)[] NOT NULL,
        "category_other" varchar(60),
        "contact_name" varchar(80),
        "email" varchar(160),
        "phone" varchar(11),
        "city" varchar(60),
        "state" varchar(2),
        "pix_key_type" varchar(6)
          CHECK ("pix_key_type" IN ('CPF', 'CNPJ', 'PHONE', 'EMAIL', 'RANDOM')),
        "pix_key" varchar(77),
        "notes" varchar(500),
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CONSTRAINT "ck_suppliers_pix" CHECK (
          ("pix_key_type" IS NULL) = ("pix_key" IS NULL)
        ),
        CONSTRAINT "ck_suppliers_categories" CHECK (
          cardinality("categories") > 0
          AND "categories" <@ ARRAY['MAINTENANCE', 'ELECTRICAL', 'PLUMBING',
                                    'PAINTING', 'CONSTRUCTION', 'ELEVATORS',
                                    'CLEANING', 'PEST_CONTROL', 'GARDENING',
                                    'POOL', 'SECURITY', 'TECHNOLOGY',
                                    'OFFICE', 'FOOD', 'EVENTS', 'FURNITURE',
                                    'UNIFORMS', 'GAS', 'PROFESSIONAL',
                                    'OTHER']::varchar(12)[]
        ),
        CONSTRAINT "ck_suppliers_category_other" CHECK (
          ('OTHER' = ANY("categories")) = ("category_other" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_suppliers_document" ON "tb_suppliers" ("idtb_condominiums", "document")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_suppliers_name" ON "tb_suppliers" ("idtb_condominiums", "active", "name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_suppliers"`);
    await queryRunner.query(
      `DELETE FROM "tb_condominium_modules" WHERE "module" = 'PURCHASES'`,
    );
    await queryRunner.query(`
      ALTER TABLE "tb_condominium_modules"
        DROP CONSTRAINT "ck_condominium_modules_module",
        ADD CONSTRAINT "ck_condominium_modules_module"
          CHECK ("module" IN ('EVENTS', 'BOOKINGS', 'PARCELS', 'LOST_AND_FOUND'))`);
  }
}
