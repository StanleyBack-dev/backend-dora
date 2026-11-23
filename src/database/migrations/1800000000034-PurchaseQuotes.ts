import type { MigrationInterface, QueryRunner } from "typeorm";

// Purchases: the quotes of a purchase request (cotações). One per supplier
// and request: a unit price per item (null: the supplier doesn't have it),
// shipping, other charges, a discount, delivery time, how it is paid
// (with the monthly interest of the installments, Price table), (method, installments; "Outro"
// typed in payment_terms), how long it is valid, notes and
// the supplier's document (PDF or image). The management chooses one
// (tb_purchase_requests.chosen_*), with a justification when it isn't the
// cheapest complete quote or there are fewer than three; the request then
// waits for the approval.
export class PurchaseQuotes1800000000034 implements MigrationInterface {
  name = "PurchaseQuotes1800000000034";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_purchase_quotes" (
        "idtb_purchase_quotes" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_purchase_requests" uuid NOT NULL
          REFERENCES "tb_purchase_requests" ("idtb_purchase_requests") ON DELETE CASCADE,
        "idtb_suppliers" uuid NOT NULL
          REFERENCES "tb_suppliers" ("idtb_suppliers"),
        "shipping_cents" bigint NOT NULL DEFAULT 0 CHECK ("shipping_cents" >= 0),
        "charges_cents" bigint NOT NULL DEFAULT 0 CHECK ("charges_cents" >= 0),
        "charges" jsonb NOT NULL DEFAULT '[]',
        "discount_cents" bigint NOT NULL DEFAULT 0 CHECK ("discount_cents" >= 0),
        "discount_percent_bp" integer
          CHECK ("discount_percent_bp" BETWEEN 1 AND 10000),
        "interest_rate_bp" integer CHECK ("interest_rate_bp" BETWEEN 1 AND 2000),
        "delivery_days" smallint CHECK ("delivery_days" BETWEEN 0 AND 365),
        "payment_method" varchar(13)
          CHECK ("payment_method" IN ('PIX', 'CASH', 'DEBIT_CARD',
                                      'CREDIT_CARD', 'BOLETO',
                                      'BANK_TRANSFER', 'INVOICE', 'OTHER')),
        "installments" smallint CHECK ("installments" BETWEEN 2 AND 60),
        "payment_terms" varchar(120),
        "valid_until" date,
        "notes" varchar(500),
        "file_key" varchar(300),
        "file_is_pdf" boolean,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        UNIQUE ("idtb_purchase_requests", "idtb_suppliers"),
        CONSTRAINT "ck_purchase_quotes_installments" CHECK (
          "installments" IS NULL
          OR "payment_method" IN ('CREDIT_CARD', 'BOLETO', 'INVOICE', 'OTHER')
        ),
        CONSTRAINT "ck_purchase_quotes_interest" CHECK (
          "interest_rate_bp" IS NULL OR "installments" IS NOT NULL
        ),
        CONSTRAINT "ck_purchase_quotes_other_payment" CHECK (
          ("payment_method" = 'OTHER') = ("payment_terms" IS NOT NULL)
        ),
        CONSTRAINT "ck_purchase_quotes_file" CHECK (
          ("file_key" IS NULL) = ("file_is_pdf" IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "tb_purchase_quote_items" (
        "idtb_purchase_quotes" uuid NOT NULL
          REFERENCES "tb_purchase_quotes" ("idtb_purchase_quotes") ON DELETE CASCADE,
        "idtb_purchase_request_items" uuid NOT NULL
          REFERENCES "tb_purchase_request_items" ("idtb_purchase_request_items") ON DELETE CASCADE,
        "unit_price_cents" bigint CHECK ("unit_price_cents" >= 0),
        PRIMARY KEY ("idtb_purchase_quotes", "idtb_purchase_request_items")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "tb_purchase_requests"
        ADD COLUMN "chosen_quote_id" uuid
          REFERENCES "tb_purchase_quotes" ("idtb_purchase_quotes") ON DELETE SET NULL,
        ADD COLUMN "choice_justification" varchar(300),
        ADD COLUMN "chosen_at" timestamptz,
        ADD COLUMN "chosen_by" uuid
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tb_purchase_requests"
        DROP COLUMN "chosen_by",
        DROP COLUMN "chosen_at",
        DROP COLUMN "choice_justification",
        DROP COLUMN "chosen_quote_id"
    `);
    await queryRunner.query(`DROP TABLE "tb_purchase_quote_items"`);
    await queryRunner.query(`DROP TABLE "tb_purchase_quotes"`);
  }
}
