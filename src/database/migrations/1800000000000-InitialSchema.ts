import type { MigrationInterface, QueryRunner } from "typeorm";

// Dora starts from a clean database with the platform core: accounts and
// sessions, access control, public sign-up, notifications (outbox, inbox,
// Web Push), announcements, support and the system log. Each module that
// comes next (bookings first) adds its own migration on top of this one.
//
// Stamped tables (see audit/domain/record-stamp.ts) carry created_at,
// created_by, updated_at and updated_by instead of a separate audit log.
export class InitialSchema1800000000000 implements MigrationInterface {
  name = "InitialSchema1800000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Accent-insensitive search (names typed with or without accents).
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

    // === shared: lease lock (concurrent serverless invocations) ===
    await queryRunner.query(`
      CREATE TABLE "tb_locks" (
        "name" varchar(64) PRIMARY KEY,
        "holder" varchar(64) NOT NULL,
        "lease_until" timestamptz NOT NULL
      )
    `);

    // === shared: fixed-window counters for per-IP limits (HMAC keys only) ===
    await queryRunner.query(`
      CREATE TABLE "tb_rate_limits" (
        "key" varchar(200) PRIMARY KEY,
        "window_start" timestamptz NOT NULL,
        "hits" int NOT NULL CHECK ("hits" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_rate_limits_window" ON "tb_rate_limits" ("window_start")`,
    );

    // === identity ===
    await queryRunner.query(`
      CREATE TABLE "tb_users" (
        "idtb_users" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "email" varchar(254) NOT NULL,
        "username" varchar(32) NOT NULL,
        "group" varchar(16) NOT NULL
          CHECK ("group" IN ('USER', 'ADMIN', 'ADMIN_MASTER')),
        "active" boolean NOT NULL DEFAULT true,
        "deactivated_at" timestamptz,
        "last_login_at" timestamptz,
        "avatar_key" varchar(200),
        "onboarding_completed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_by" uuid
      )
    `);
    // Self-references are added after the table exists.
    await queryRunner.query(`
      ALTER TABLE "tb_users"
        ADD CONSTRAINT "fk_users_created_by" FOREIGN KEY ("created_by")
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        ADD CONSTRAINT "fk_users_updated_by" FOREIGN KEY ("updated_by")
          REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_username" ON "tb_users" ("username")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email_lower" ON "tb_users" (lower("email"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_auth_credentials" (
        "idtb_users" uuid PRIMARY KEY
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "password_hash" varchar(255) NOT NULL,
        "must_change_password" boolean NOT NULL DEFAULT true,
        "failed_login_attempts" int NOT NULL DEFAULT 0,
        "locked_until" timestamptz,
        "password_changed_at" timestamptz,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tb_sessions" (
        "idtb_sessions" uuid PRIMARY KEY,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "refresh_secret_hash" varchar(128) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "last_used_at" timestamptz NOT NULL,
        "ip_address" varchar(64),
        "user_agent" varchar(512),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_sessions_user" ON "tb_sessions" ("idtb_users")`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_auth_verification_codes" (
        "idtb_auth_verification_codes" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "purpose" varchar(32) NOT NULL,
        "code_hash" varchar(128) NOT NULL,
        "attempts" int NOT NULL DEFAULT 0,
        "max_attempts" int NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "verified_at" timestamptz,
        "reset_token_hash" varchar(128),
        "reset_token_expires_at" timestamptz,
        "consumed_at" timestamptz,
        "invalidated_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_verification_codes_user_purpose" ON "tb_auth_verification_codes" ("idtb_users", "purpose", "created_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_verification_codes_reset_token" ON "tb_auth_verification_codes" ("reset_token_hash") WHERE "reset_token_hash" IS NOT NULL`,
    );

    // === access control: per-user exceptions to the group's permissions ===
    await queryRunner.query(`
      CREATE TABLE "tb_user_permission_overrides" (
        "idtb_user_permission_overrides" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "permission" varchar(64) NOT NULL,
        "allowed" boolean NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_permission_overrides_user_permission"
          UNIQUE ("idtb_users", "permission")
      )
    `);

    // === enrollment: invite code -> public form -> manager's review ===
    await queryRunner.query(`
      CREATE TABLE "tb_enrollment_invites" (
        "idtb_enrollment_invites" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(6) NOT NULL CHECK ("code" ~ '^[0-9]{6}$'),
        "label" varchar(80) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_by" uuid NOT NULL REFERENCES "tb_users" ("idtb_users"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_enrollment_invites_code" ON "tb_enrollment_invites" ("code") WHERE "revoked_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_enrollment_requests" (
        "idtb_enrollment_requests" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_enrollment_invites" uuid
          REFERENCES "tb_enrollment_invites" ("idtb_enrollment_invites")
          ON DELETE SET NULL,
        "status" varchar(10) NOT NULL DEFAULT 'PENDENTE'
          CHECK ("status" IN ('PENDENTE', 'APROVADA', 'RECUSADA')),
        "full_name" varchar(160) NOT NULL,
        "email" varchar(254) NOT NULL,
        "phone" varchar(11) NOT NULL,
        "photo_key" varchar(200),
        "consent_at" timestamptz NOT NULL,
        "reviewed_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "reviewed_at" timestamptz,
        "rejection_reason" varchar(500),
        "idtb_users" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_enrollment_requests_status" ON "tb_enrollment_requests" ("status", "created_at" DESC)`,
    );

    // === outbox: transactional queue between modules, with retries ===
    await queryRunner.query(`
      CREATE TABLE "tb_outbox" (
        "idtb_outbox" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "topic" varchar(60) NOT NULL,
        "payload" jsonb NOT NULL,
        "dedupe_key" varchar(200),
        "status" varchar(8) NOT NULL DEFAULT 'PENDING'
          CHECK ("status" IN ('PENDING', 'DONE', 'FAILED')),
        "attempts" smallint NOT NULL DEFAULT 0,
        "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
        "locked_until" timestamptz,
        "last_error" varchar(1000),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "processed_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "ux_outbox_dedupe_key" ON "tb_outbox" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_outbox_due" ON "tb_outbox" ("next_attempt_at") WHERE "status" = 'PENDING'`,
    );

    // === notifications: inbox, e-mail preferences, Web Push devices ===
    await queryRunner.query(`
      CREATE TABLE "tb_notifications" (
        "idtb_notifications" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "type" varchar(32) NOT NULL,
        "title" varchar(160) NOT NULL,
        "body" varchar(1000) NOT NULL,
        "link" varchar(300),
        "source_id" uuid UNIQUE,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_notifications_user_created" ON "tb_notifications" ("idtb_users", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_notifications_unread" ON "tb_notifications" ("idtb_users") WHERE "read_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_notification_prefs" (
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "type" varchar(32) NOT NULL,
        "email_enabled" boolean NOT NULL,
        PRIMARY KEY ("idtb_users", "type")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tb_push_subscriptions" (
        "idtb_push_subscriptions" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "endpoint" varchar(1000) NOT NULL UNIQUE,
        "p256dh" varchar(200) NOT NULL,
        "auth" varchar(100) NOT NULL,
        "user_agent" varchar(300),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "last_used_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_push_subscriptions_user" ON "tb_push_subscriptions" ("idtb_users")`,
    );

    // === broadcasts (comunicados): everyone or one access group ===
    await queryRunner.query(`
      CREATE TABLE "tb_broadcasts" (
        "idtb_broadcasts" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(120) NOT NULL,
        "body" varchar(2000) NOT NULL,
        "audience" varchar(16) NOT NULL
          CHECK ("audience" IN ('TODOS', 'GRUPO')),
        "target_group" varchar(16)
          CHECK ("target_group" IN ('USER', 'ADMIN', 'ADMIN_MASTER')),
        "send_email" boolean NOT NULL,
        "recipients" int NOT NULL,
        "created_by" uuid NOT NULL REFERENCES "tb_users" ("idtb_users"),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CHECK (("audience" = 'GRUPO') = ("target_group" IS NOT NULL))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_broadcasts_created" ON "tb_broadcasts" ("created_at" DESC)`,
    );

    // === support: requests answered by the administrators ===
    // The protocol is a plain sequence people can quote.
    await queryRunner.query(`
      CREATE TABLE "tb_support_requests" (
        "idtb_support_requests" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "protocol" integer GENERATED ALWAYS AS IDENTITY UNIQUE,
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "category" varchar(16) NOT NULL
          CHECK ("category" IN ('DUVIDA', 'PROBLEMA', 'ACESSO', 'SUGESTAO', 'OUTRO')),
        "subject" varchar(120) NOT NULL,
        "message" varchar(2000) NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'ABERTO'
          CHECK ("status" IN ('ABERTO', 'RESPONDIDO', 'FINALIZADO')),
        "reply" varchar(2000),
        "replied_at" timestamptz,
        "replied_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "finalized_at" timestamptz,
        "finalized_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    // The daily limit counts a person's requests of the day.
    await queryRunner.query(
      `CREATE INDEX "ix_support_requests_user_created" ON "tb_support_requests" ("idtb_users", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_support_requests_status_created" ON "tb_support_requests" ("status", "created_at" DESC)`,
    );

    // === system log (Administração -> Logs), kept for 90 days ===
    await queryRunner.query(`
      CREATE TABLE "tb_system_logs" (
        "idtb_system_logs" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "level" varchar(10) NOT NULL
          CHECK ("level" IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
        "category" varchar(12) NOT NULL,
        "source" varchar(200) NOT NULL,
        "message" varchar(1000) NOT NULL,
        "details" jsonb,
        "idtb_users" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "ip" varchar(64),
        "status_code" integer,
        "duration_ms" integer,
        "environment" varchar(20) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_system_logs_created" ON "tb_system_logs" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_system_logs_level_created" ON "tb_system_logs" ("level", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_system_logs_category_created" ON "tb_system_logs" ("category", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "tb_system_logs",
      "tb_support_requests",
      "tb_broadcasts",
      "tb_push_subscriptions",
      "tb_notification_prefs",
      "tb_notifications",
      "tb_outbox",
      "tb_enrollment_requests",
      "tb_enrollment_invites",
      "tb_user_permission_overrides",
      "tb_auth_verification_codes",
      "tb_sessions",
      "tb_auth_credentials",
      "tb_users",
      "tb_rate_limits",
      "tb_locks",
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }
}
