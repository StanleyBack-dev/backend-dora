import type { MigrationInterface, QueryRunner } from "typeorm";

// The catalog and the purchase requests.
// - tb_products / tb_brands: the condominium's catalog (a name once per
//   condominium, whatever the case), shared by the modules that deal with
//   things (purchases now; stock or maintenance later). Deactivated, never
//   deleted, so what used them keeps them.
// - tb_purchase_requests (solicitações de compra): someone of the team says
//   what is needed (title, categories, priority, where, by when); numbered
//   in the condominium (SC-0001…), it goes through quotes, approval and
//   delivery (the statuses after OPEN arrive with the next phases). Edited
//   or cancelled (with a reason) while still OPEN.
// - tb_purchase_request_items: a product of the catalog, how many, in which
//   unit, the brand (null: any brand) and a note.
export class PurchaseRequests1800000000032 implements MigrationInterface {
  name = "PurchaseRequests1800000000032";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_products" (
        "idtb_products" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "name" varchar(120) NOT NULL,
        "unit" varchar(12) NOT NULL,
        "description" varchar(300),
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_products_name" ON "tb_products" ("idtb_condominiums", lower("name"))`,
    );
    await queryRunner.query(`
      CREATE TABLE "tb_brands" (
        "idtb_brands" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "name" varchar(60) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_brands_name" ON "tb_brands" ("idtb_condominiums", lower("name"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_purchase_requests" (
        "idtb_purchase_requests" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "number" integer NOT NULL CHECK ("number" > 0),
        "title" varchar(120) NOT NULL,
        "description" varchar(1000),
        "categories" varchar(12)[] NOT NULL,
        "category_other" varchar(60),
        "priority" varchar(6) NOT NULL DEFAULT 'NORMAL'
          CHECK ("priority" IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
        "location" varchar(80),
        "needed_by" date,
        "status" varchar(17) NOT NULL DEFAULT 'OPEN'
          CHECK ("status" IN ('OPEN', 'QUOTING', 'AWAITING_APPROVAL',
                              'APPROVED', 'ORDERED', 'RECEIVED', 'COMPLETED',
                              'REJECTED', 'CANCELLED')),
        "requested_by" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users"),
        "cancel_reason" varchar(300),
        "cancelled_at" timestamptz,
        "cancelled_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CONSTRAINT "ck_purchase_requests_categories" CHECK (
          cardinality("categories") > 0
          AND "categories" <@ ARRAY['MAINTENANCE', 'ELECTRICAL', 'PLUMBING',
                                    'PAINTING', 'CONSTRUCTION', 'ELEVATORS',
                                    'CLEANING', 'PEST_CONTROL', 'GARDENING',
                                    'POOL', 'SECURITY', 'TECHNOLOGY',
                                    'OFFICE', 'FOOD', 'EVENTS', 'FURNITURE',
                                    'UNIFORMS', 'GAS', 'PROFESSIONAL',
                                    'OTHER']::varchar(12)[]
        ),
        CONSTRAINT "ck_purchase_requests_category_other" CHECK (
          ('OTHER' = ANY("categories")) = ("category_other" IS NOT NULL)
        ),
        CONSTRAINT "ck_purchase_requests_cancelled" CHECK (
          ("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_purchase_requests_number" ON "tb_purchase_requests" ("idtb_condominiums", "number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_purchase_requests_status" ON "tb_purchase_requests" ("idtb_condominiums", "status", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_purchase_requests_requester" ON "tb_purchase_requests" ("requested_by", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_purchase_request_items" (
        "idtb_purchase_request_items" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_purchase_requests" uuid NOT NULL
          REFERENCES "tb_purchase_requests" ("idtb_purchase_requests") ON DELETE CASCADE,
        "position" smallint NOT NULL CHECK ("position" > 0),
        "idtb_products" uuid NOT NULL
          REFERENCES "tb_products" ("idtb_products"),
        "quantity" numeric(12, 2) NOT NULL CHECK ("quantity" > 0),
        "unit" varchar(12) NOT NULL,
        "idtb_brands" uuid REFERENCES "tb_brands" ("idtb_brands"),
        "note" varchar(200),
        UNIQUE ("idtb_purchase_requests", "position")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_purchase_request_items_product" ON "tb_purchase_request_items" ("idtb_products")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_purchase_request_items_brand" ON "tb_purchase_request_items" ("idtb_brands") WHERE "idtb_brands" IS NOT NULL`,
    );
  }

  // IF EXISTS: an earlier draft of this migration (requests only) may be
  // the one applied in a development database.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_purchase_request_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_purchase_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_brands"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tb_products"`);
  }
}
