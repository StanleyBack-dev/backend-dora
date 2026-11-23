import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Purchases: after the approval, the order, the deliveries and the payment.
 *
 * tb_purchase_orders: one per approved request (ordem de compra, "OC-0001",
 * numbered per condominium), with the chosen quote as it was then
 * (supplier, totals, payment) and the delivery expected.
 *
 * tb_purchase_receipts (+ items): each delivery, with what arrived of each
 * item (a delivery may bring part of it), who received it and the invoice
 * (nota fiscal: number, value, date, file). The request is "received" once
 * every item arrived in full.
 *
 * tb_purchase_installments: what is paid, from the chosen quote's
 * installments (one when paid at once), each with its due day and, once
 * paid, the day, who marked it and the proof. Received and paid in full,
 * the request is completed.
 *
 * tb_supplier_ratings: a supplier's ratings (1 to 5 and a comment), one per
 * source (here, a completed purchase order); the suppliers registry shows
 * the average.
 */
export class PurchaseOrders1800000000036 implements MigrationInterface {
  name = "PurchaseOrders1800000000036";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_purchase_orders" (
        "idtb_purchase_orders" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "idtb_purchase_requests" uuid NOT NULL UNIQUE
          REFERENCES "tb_purchase_requests" ("idtb_purchase_requests") ON DELETE CASCADE,
        "idtb_purchase_quotes" uuid
          REFERENCES "tb_purchase_quotes" ("idtb_purchase_quotes") ON DELETE SET NULL,
        "idtb_suppliers" uuid
          REFERENCES "tb_suppliers" ("idtb_suppliers") ON DELETE SET NULL,
        "number" integer NOT NULL CHECK ("number" > 0),
        "supplier_name" varchar(160) NOT NULL,
        "items_cents" bigint NOT NULL CHECK ("items_cents" >= 0),
        "total_cents" bigint NOT NULL CHECK ("total_cents" >= 0),
        "payment_method" varchar(13),
        "payment_terms" varchar(120),
        "expected_on" date,
        "notes" varchar(500),
        "ordered_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "ordered_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        CONSTRAINT "uq_purchase_orders_number" UNIQUE ("idtb_condominiums", "number")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tb_purchase_receipts" (
        "idtb_purchase_receipts" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_purchase_orders" uuid NOT NULL
          REFERENCES "tb_purchase_orders" ("idtb_purchase_orders") ON DELETE CASCADE,
        "received_on" date NOT NULL,
        "invoice_number" varchar(40),
        "invoice_cents" bigint CHECK ("invoice_cents" >= 0),
        "invoice_date" date,
        "file_key" varchar(300),
        "file_is_pdf" boolean,
        "note" varchar(300),
        "received_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_purchase_receipts_order" ON "tb_purchase_receipts" ("idtb_purchase_orders", "received_on")`,
    );
    await queryRunner.query(`
      CREATE TABLE "tb_purchase_receipt_items" (
        "idtb_purchase_receipts" uuid NOT NULL
          REFERENCES "tb_purchase_receipts" ("idtb_purchase_receipts") ON DELETE CASCADE,
        "idtb_purchase_request_items" uuid NOT NULL
          REFERENCES "tb_purchase_request_items" ("idtb_purchase_request_items") ON DELETE CASCADE,
        "quantity" numeric(12, 2) NOT NULL CHECK ("quantity" > 0),
        PRIMARY KEY ("idtb_purchase_receipts", "idtb_purchase_request_items")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tb_purchase_installments" (
        "idtb_purchase_installments" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_purchase_orders" uuid NOT NULL
          REFERENCES "tb_purchase_orders" ("idtb_purchase_orders") ON DELETE CASCADE,
        "number" smallint NOT NULL CHECK ("number" > 0),
        "amount_cents" bigint NOT NULL CHECK ("amount_cents" >= 0),
        "due_on" date NOT NULL,
        "paid_on" date,
        "paid_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "proof_key" varchar(300),
        "proof_is_pdf" boolean,
        "note" varchar(300),
        CONSTRAINT "uq_purchase_installments_number" UNIQUE ("idtb_purchase_orders", "number")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tb_supplier_ratings" (
        "idtb_supplier_ratings" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_suppliers" uuid NOT NULL
          REFERENCES "tb_suppliers" ("idtb_suppliers") ON DELETE CASCADE,
        "source" varchar(20) NOT NULL,
        "source_id" uuid NOT NULL,
        "rating" smallint NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
        "comment" varchar(300),
        "rated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "rated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_supplier_ratings_source" UNIQUE ("source", "source_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_supplier_ratings_supplier" ON "tb_supplier_ratings" ("idtb_suppliers")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_supplier_ratings"`);
    await queryRunner.query(`DROP TABLE "tb_purchase_installments"`);
    await queryRunner.query(`DROP TABLE "tb_purchase_receipt_items"`);
    await queryRunner.query(`DROP TABLE "tb_purchase_receipts"`);
    await queryRunner.query(`DROP TABLE "tb_purchase_orders"`);
  }
}
