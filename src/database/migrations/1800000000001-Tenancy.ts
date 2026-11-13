import type { MigrationInterface, QueryRunner } from "typeorm";

// Multi-tenancy: every condominium is a tenant. People keep one account
// (login, password, photo) and join one or more condominiums through a
// membership, which carries their role there (resident or manager) and their
// unit. Data that belongs to a condominium carries its id; the API takes it
// from the session, never from the client.
//
// tb_users.group becomes the platform role only: ADMIN_MASTER (runs the
// platform) or USER (everyone else). ADMIN moves to the membership.
//
// Sign-up invites, sign-up requests and announcements created before this
// migration belong to no condominium and are removed (the platform had no
// tenants yet). Per-user permission overrides become per-membership.
export class Tenancy1800000000001 implements MigrationInterface {
  name = "Tenancy1800000000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tb_condominiums" (
        "idtb_condominiums" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(120) NOT NULL,
        "document" varchar(14) CHECK ("document" ~ '^[0-9]{14}$'),
        "city" varchar(80) NOT NULL,
        "state" char(2) NOT NULL CHECK ("state" ~ '^[A-Z]{2}$'),
        "status" varchar(10) NOT NULL DEFAULT 'ACTIVE'
          CHECK ("status" IN ('ACTIVE', 'SUSPENDED')),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_condominiums_document" ON "tb_condominiums" ("document") WHERE "document" IS NOT NULL`,
    );

    // An empty block means the condominium has no blocks (houses, one tower).
    await queryRunner.query(`
      CREATE TABLE "tb_units" (
        "idtb_units" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "block" varchar(30) NOT NULL DEFAULT '',
        "number" varchar(20) NOT NULL CHECK ("number" <> ''),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_units_condominium_block_number" ON "tb_units" ("idtb_condominiums", lower("block"), lower("number"))`,
    );

    await queryRunner.query(`
      CREATE TABLE "tb_memberships" (
        "idtb_memberships" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_users" uuid NOT NULL
          REFERENCES "tb_users" ("idtb_users") ON DELETE CASCADE,
        "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        "role" varchar(10) NOT NULL CHECK ("role" IN ('USER', 'ADMIN')),
        "idtb_units" uuid REFERENCES "tb_units" ("idtb_units") ON DELETE SET NULL,
        "active" boolean NOT NULL DEFAULT true,
        "last_selected_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "created_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        "updated_by" uuid REFERENCES "tb_users" ("idtb_users") ON DELETE SET NULL,
        CONSTRAINT "uq_memberships_user_condominium"
          UNIQUE ("idtb_users", "idtb_condominiums")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_memberships_condominium" ON "tb_memberships" ("idtb_condominiums", "active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_memberships_unit" ON "tb_memberships" ("idtb_units")`,
    );

    // === platform role ===
    await queryRunner.query(
      `UPDATE "tb_users" SET "group" = 'USER' WHERE "group" = 'ADMIN'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_users" DROP CONSTRAINT IF EXISTS "tb_users_group_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_users" ADD CONSTRAINT "ck_users_platform_group" CHECK ("group" IN ('USER', 'ADMIN_MASTER'))`,
    );

    // === the condominium a session is working in ===
    await queryRunner.query(`
      ALTER TABLE "tb_sessions" ADD COLUMN "idtb_condominiums" uuid
        REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE SET NULL
    `);

    // === permission overrides: per membership ===
    await queryRunner.query(`DROP TABLE "tb_user_permission_overrides"`);
    await queryRunner.query(`
      CREATE TABLE "tb_membership_permission_overrides" (
        "idtb_membership_permission_overrides" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "idtb_memberships" uuid NOT NULL
          REFERENCES "tb_memberships" ("idtb_memberships") ON DELETE CASCADE,
        "permission" varchar(64) NOT NULL,
        "allowed" boolean NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_permission_overrides_membership_permission"
          UNIQUE ("idtb_memberships", "permission")
      )
    `);

    // === enrollment: invites and requests belong to a condominium ===
    await queryRunner.query(`DELETE FROM "tb_enrollment_requests"`);
    await queryRunner.query(`DELETE FROM "tb_enrollment_invites"`);
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_invites" ADD COLUMN "idtb_condominiums" uuid NOT NULL
        REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_enrollment_invites_condominium" ON "tb_enrollment_invites" ("idtb_condominiums", "created_at" DESC)`,
    );
    await queryRunner.query(`
      ALTER TABLE "tb_enrollment_requests"
        ADD COLUMN "idtb_condominiums" uuid NOT NULL
          REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE,
        ADD COLUMN "idtb_units" uuid
          REFERENCES "tb_units" ("idtb_units") ON DELETE SET NULL
    `);
    await queryRunner.query(`DROP INDEX "ix_enrollment_requests_status"`);
    await queryRunner.query(
      `CREATE INDEX "ix_enrollment_requests_condominium_status" ON "tb_enrollment_requests" ("idtb_condominiums", "status", "created_at" DESC)`,
    );

    // === announcements: sent inside one condominium, to its members ===
    await queryRunner.query(`DELETE FROM "tb_broadcasts"`);
    await queryRunner.query(`
      ALTER TABLE "tb_broadcasts" ADD COLUMN "idtb_condominiums" uuid NOT NULL
        REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE CASCADE
    `);
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" DROP CONSTRAINT IF EXISTS "tb_broadcasts_target_group_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" ADD CONSTRAINT "ck_broadcasts_target_group" CHECK ("target_group" IN ('USER', 'ADMIN'))`,
    );
    await queryRunner.query(`DROP INDEX "ix_broadcasts_created"`);
    await queryRunner.query(
      `CREATE INDEX "ix_broadcasts_condominium_created" ON "tb_broadcasts" ("idtb_condominiums", "created_at" DESC)`,
    );

    // === support: the platform answers; the condominium is context only ===
    await queryRunner.query(`
      ALTER TABLE "tb_support_requests" ADD COLUMN "idtb_condominiums" uuid
        REFERENCES "tb_condominiums" ("idtb_condominiums") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tb_support_requests" DROP COLUMN "idtb_condominiums"`,
    );

    await queryRunner.query(`DROP INDEX "ix_broadcasts_condominium_created"`);
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" DROP CONSTRAINT "ck_broadcasts_target_group"`,
    );
    await queryRunner.query(`DELETE FROM "tb_broadcasts"`);
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" DROP COLUMN "idtb_condominiums"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_broadcasts" ADD CONSTRAINT "tb_broadcasts_target_group_check" CHECK ("target_group" IN ('USER', 'ADMIN', 'ADMIN_MASTER'))`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_broadcasts_created" ON "tb_broadcasts" ("created_at" DESC)`,
    );

    await queryRunner.query(
      `DROP INDEX "ix_enrollment_requests_condominium_status"`,
    );
    await queryRunner.query(`DELETE FROM "tb_enrollment_requests"`);
    await queryRunner.query(`DELETE FROM "tb_enrollment_invites"`);
    await queryRunner.query(
      `ALTER TABLE "tb_enrollment_requests" DROP COLUMN "idtb_units", DROP COLUMN "idtb_condominiums"`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_enrollment_requests_status" ON "tb_enrollment_requests" ("status", "created_at" DESC)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tb_enrollment_invites" DROP COLUMN "idtb_condominiums"`,
    );

    await queryRunner.query(`DROP TABLE "tb_membership_permission_overrides"`);
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

    await queryRunner.query(
      `ALTER TABLE "tb_sessions" DROP COLUMN "idtb_condominiums"`,
    );

    await queryRunner.query(
      `ALTER TABLE "tb_users" DROP CONSTRAINT "ck_users_platform_group"`,
    );
    // Managers go back to being ADMIN accounts.
    await queryRunner.query(`
      UPDATE "tb_users" u SET "group" = 'ADMIN'
        WHERE u."group" = 'USER' AND EXISTS (
          SELECT 1 FROM "tb_memberships" m
           WHERE m."idtb_users" = u."idtb_users" AND m."role" = 'ADMIN')
    `);
    await queryRunner.query(
      `ALTER TABLE "tb_users" ADD CONSTRAINT "tb_users_group_check" CHECK ("group" IN ('USER', 'ADMIN', 'ADMIN_MASTER'))`,
    );

    await queryRunner.query(`DROP TABLE "tb_memberships"`);
    await queryRunner.query(`DROP TABLE "tb_units"`);
    await queryRunner.query(`DROP TABLE "tb_condominiums"`);
  }
}
