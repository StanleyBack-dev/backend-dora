import type { MigrationInterface, QueryRunner } from "typeorm";

// The public landing page (separate site, same database):
// - tb_landing_leads: messages of its contact form, e-mailed to the Dora
//   inbox (mail_status: SENT, FAILED, or HELD when the anti-flood hourly
//   e-mail limit was reached) with where the visitor
//   came from (UTM parameters, referring site).
// - tb_landing_events: anonymous analytics (page views, sections seen,
//   clicks, videos, form steps, scroll depth). A random visitor/session id
//   only: no IP and no personal data. Append-only.
export class LandingPage1800000000019 implements MigrationInterface {
  name = "LandingPage1800000000019";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_landing_leads" (
        "idtb_landing_leads" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "email" varchar(160) NOT NULL,
        "phone" varchar(30),
        "condominium" varchar(160),
        "role" varchar(16) NOT NULL
          CHECK ("role" IN ('SINDICO', 'ADMINISTRADORA', 'CONSELHO', 'MORADOR', 'OUTRO')),
        "units_range" varchar(16)
          CHECK ("units_range" IN ('ATE_50', 'DE_51_A_150', 'DE_151_A_400', 'MAIS_DE_400')),
        "subject" varchar(16) NOT NULL
          CHECK ("subject" IN ('DEMONSTRACAO', 'ORCAMENTO', 'DUVIDA', 'PARCERIA', 'SUPORTE')),
        "message" varchar(3000) NOT NULL,
        "visitor_id" uuid,
        "referrer_host" varchar(200),
        "utm_source" varchar(100),
        "utm_medium" varchar(100),
        "utm_campaign" varchar(100),
        "mail_status" varchar(8) NOT NULL DEFAULT 'PENDING'
          CHECK ("mail_status" IN ('PENDING', 'SENT', 'FAILED', 'HELD')),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_landing_leads_created_at" ON "tb_landing_leads" ("created_at")`,
    );
    // Anti-spam: the same e-mail sending the same message again.
    await queryRunner.query(
      `CREATE INDEX "ix_landing_leads_email_created_at" ON "tb_landing_leads" ("email", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_landing_events" (
        "idtb_landing_events" bigserial PRIMARY KEY,
        "visitor_id" uuid NOT NULL,
        "session_id" uuid NOT NULL,
        "type" varchar(16) NOT NULL,
        "name" varchar(80),
        "path" varchar(200) NOT NULL,
        "referrer_host" varchar(200),
        "utm_source" varchar(100),
        "utm_medium" varchar(100),
        "utm_campaign" varchar(100),
        "device" varchar(8) NOT NULL
          CHECK ("device" IN ('MOBILE', 'TABLET', 'DESKTOP')),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_landing_events_created_at" ON "tb_landing_events" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_landing_events_type_created_at" ON "tb_landing_events" ("type", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tb_landing_events"`);
    await queryRunner.query(`DROP TABLE "tb_landing_leads"`);
  }
}
