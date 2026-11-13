import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { PasswordService } from "@/modules/identity/application/password.service";
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepositoryPort,
} from "@/modules/identity/application/ports/credential-repository.port";
import {
  IDENTITY_NOTIFIER,
  type IdentityNotifierPort,
} from "@/modules/identity/application/ports/identity-notifier.port";
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepositoryPort,
} from "@/modules/identity/application/ports/membership-repository.port";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import {
  USER_REPOSITORY,
  type MemberAccount,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import { UNLOCKED } from "@/modules/identity/domain/lockout-policy";
import {
  normalizeEmail,
  normalizeUsername,
} from "@/modules/identity/domain/username";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { UserManagementPolicy } from "@/modules/identity/application/user-management.policy";

export type CreateMemberInput = {
  name: string;
  email: string;
  /** Derived from the name when left out ("ana.souza", "ana.souza2"…). */
  username?: string | null;
  /** Role in the condominium: USER (resident) or ADMIN (manager). */
  group: UserGroup;
  unitId?: string | null;
};

export type UpdateMemberInput = {
  name?: string;
  email?: string;
  username?: string;
  group?: UserGroup;
  /** undefined: unchanged; null: no unit. */
  unitId?: string | null;
};

/**
 * Result of adding someone. A new account gets a temporary password (shown
 * once, also sent by e-mail); a person who already has a Dora account just
 * gains this condominium and keeps signing in as before.
 */
export type TemporaryAccess = {
  user: MemberAccount;
  temporaryPassword: string | null;
  emailSent: boolean;
  existingAccount: boolean;
};

@Injectable()
export class ManageUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly memberships: MembershipRepositoryPort,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepositoryPort,
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(IDENTITY_NOTIFIER) private readonly notifier: IdentityNotifierPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly policy: UserManagementPolicy,
    private readonly passwords: PasswordService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditTrailService,
  ) {}

  /**
   * Adds someone to the session's condominium. An e-mail that already has a
   * Dora account (e.g. someone who also lives elsewhere) joins that account
   * instead of creating a second one.
   */
  async create(
    actor: AuthenticatedUser,
    input: CreateMemberInput,
  ): Promise<TemporaryAccess> {
    const condominiumId = tenantOf(actor);
    this.policy.assertCanAssign(actor, input.group);
    const unitId = await this.policy.unitOf(condominiumId, input.unitId);
    const email = normalizeEmail(input.email);

    const existing = await this.users.findByEmail(email);
    if (existing) {
      if (await this.memberships.find(existing.id, condominiumId)) {
        throw AppException.from(APP_ERRORS.identity.alreadyMember, undefined);
      }
      const membership = await this.memberships.create({
        userId: existing.id,
        condominiumId,
        role: input.group,
        unitId,
      });
      await this.audit.stamp({
        actorId: actor.id,
        entity: "membership",
        entityId: membership.id,
        created: true,
      });
      return {
        user: await this.reload(condominiumId, existing.id),
        temporaryPassword: null,
        emailSent: false,
        existingAccount: true,
      };
    }

    const name = input.name.trim().replace(/\s+/g, " ");
    const username = input.username
      ? normalizeUsername(input.username)
      : await this.policy.freeUsername(name);
    await this.policy.assertUniqueIdentity({ username, email });

    const { temporary, hash } = await this.passwords.hashTemporary();
    const created = await this.users.createWithCredential(
      { name, email, username, group: UserGroup.USER },
      { passwordHash: hash, mustChangePassword: true },
      { condominiumId, role: input.group, unitId },
    );
    const emailSent = await this.notifier.accessCreated(created, temporary);

    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: created.id,
      created: true,
    });
    return {
      user: await this.reload(condominiumId, created.id),
      temporaryPassword: temporary,
      emailSent,
      existingAccount: false,
    };
  }

  async update(
    actor: AuthenticatedUser,
    userId: string,
    input: UpdateMemberInput,
  ): Promise<MemberAccount> {
    const condominiumId = tenantOf(actor);
    const target = await this.policy.loadManageable(actor, userId);

    // === account (login data) ===
    const name = input.name?.trim().replace(/\s+/g, " ");
    const email =
      input.email !== undefined ? normalizeEmail(input.email) : undefined;
    const username =
      input.username !== undefined
        ? normalizeUsername(input.username)
        : undefined;
    const accountPatch = {
      name: name !== undefined && name !== target.name ? name : undefined,
      email: email !== undefined && email !== target.email ? email : undefined,
      username:
        username !== undefined && username !== target.username
          ? username
          : undefined,
    };
    const accountChanged = Object.values(accountPatch).some(
      (value) => value !== undefined,
    );
    if (accountChanged) {
      this.policy.assertOwnsAccount(actor, target);
      await this.policy.assertUniqueIdentity(
        { username: accountPatch.username, email: accountPatch.email },
        userId,
      );
      await this.users.update(userId, accountPatch);
      await this.audit.stamp({
        actorId: actor.id,
        entity: "user",
        entityId: userId,
      });
    }

    // === membership (role and unit here) ===
    const roleChanged =
      input.group !== undefined && input.group !== target.role;
    if (roleChanged)
      this.policy.assertCanAssign(actor, input.group as UserGroup);
    const unitId =
      input.unitId === undefined
        ? undefined
        : await this.policy.unitOf(condominiumId, input.unitId);
    if (roleChanged || (unitId !== undefined && unitId !== target.unitId)) {
      await this.memberships.update(target.membershipId, {
        role: roleChanged ? input.group : undefined,
        unitId,
      });
      if (roleChanged) {
        await this.permissions.resetToGroupDefaults(target.membershipId);
      }
      await this.audit.stamp({
        actorId: actor.id,
        entity: "membership",
        entityId: target.membershipId,
      });
    }
    return this.reload(condominiumId, userId);
  }

  /**
   * Turns the person's access to this condominium on or off. Their account
   * (and any other condominium) is untouched.
   */
  async setActive(
    actor: AuthenticatedUser,
    userId: string,
    active: boolean,
  ): Promise<MemberAccount> {
    const target = await this.policy.loadManageable(actor, userId);
    if (target.membershipActive === active) return target;
    await this.memberships.update(target.membershipId, { active });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "membership",
      entityId: target.membershipId,
    });
    return this.reload(tenantOf(actor), userId);
  }

  async resetPassword(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<TemporaryAccess> {
    const target = await this.policy.loadManageable(actor, userId);
    this.policy.assertOwnsAccount(actor, target);
    const temporary = await this.passwords.issueTemporary(userId);
    const emailSent = await this.notifier.passwordResetByAdmin(
      target,
      temporary,
    );
    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return {
      user: await this.reload(tenantOf(actor), userId),
      temporaryPassword: temporary,
      emailSent,
      existingAccount: true,
    };
  }

  async unlock(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<MemberAccount> {
    const target = await this.policy.loadManageable(actor, userId);
    this.policy.assertOwnsAccount(actor, target);
    await this.credentials.update(userId, UNLOCKED);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return this.reload(tenantOf(actor), userId);
  }

  async revokeSessions(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<MemberAccount> {
    const target = await this.policy.loadManageable(actor, userId);
    this.policy.assertOwnsAccount(actor, target);
    await this.sessions.revokeAllForUser(userId, this.clock.now());
    await this.audit.stamp({
      actorId: actor.id,
      entity: "user",
      entityId: userId,
    });
    return this.reload(tenantOf(actor), userId);
  }

  private reload(
    condominiumId: string,
    userId: string,
  ): Promise<MemberAccount> {
    return this.policy.loadMember(condominiumId, userId);
  }
}
