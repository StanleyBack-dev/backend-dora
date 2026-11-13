import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  canAssignGroup,
  checkManagement,
} from "@/modules/access-control/domain/permission-policy";
import {
  isMemberRole,
  UserGroup,
} from "@/modules/access-control/domain/user-group";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import {
  USER_REPOSITORY,
  type MemberAccount,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import {
  isValidUsername,
  usernameBase,
} from "@/modules/identity/domain/username";

/** The rank someone has in the condominium (the platform admin outranks). */
export const rankOf = (member: MemberAccount): UserGroup =>
  member.group === UserGroup.ADMIN_MASTER
    ? UserGroup.ADMIN_MASTER
    : member.role;

// Shared checks for every operation a manager performs on a member of the
// session's condominium.
@Injectable()
export class UserManagementPolicy {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    private readonly condominiums: CondominiumLookupService,
  ) {}

  async loadMember(
    condominiumId: string,
    userId: string,
  ): Promise<MemberAccount> {
    const target = await this.users.findMember(condominiumId, userId);
    if (!target) {
      throw AppException.from(APP_ERRORS.identity.userNotFound, undefined);
    }
    return target;
  }

  async loadManageable(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<MemberAccount> {
    const target = await this.loadMember(tenantOf(actor), userId);
    const denial = checkManagement(actor, {
      id: target.id,
      group: rankOf(target),
    });
    if (denial === "self") {
      throw AppException.from(
        APP_ERRORS.accessControl.cannotManageSelf,
        undefined,
      );
    }
    if (denial === "insufficient-rank") {
      throw AppException.from(
        APP_ERRORS.accessControl.insufficientRank,
        undefined,
      );
    }
    return target;
  }

  /** Only member roles, and only below the actor's own (platform: any). */
  assertCanAssign(actor: AuthenticatedUser, group: UserGroup): void {
    if (!isMemberRole(group) || !canAssignGroup(actor.group, group)) {
      throw AppException.from(
        APP_ERRORS.accessControl.cannotAssignGroup,
        undefined,
      );
    }
  }

  /**
   * Login data (name, login, e-mail, password, lock, sessions) of an account
   * used elsewhere is not one condominium's to change: a manager could
   * otherwise take over an account that manages another condominium.
   */
  assertOwnsAccount(actor: AuthenticatedUser, target: MemberAccount): void {
    if (!actor.platformAdmin && target.sharedAccount) {
      throw AppException.from(APP_ERRORS.identity.sharedAccount, undefined);
    }
  }

  async assertUniqueIdentity(
    input: { username?: string; email?: string },
    exceptUserId?: string,
  ): Promise<void> {
    if (input.username !== undefined) {
      if (!isValidUsername(input.username)) {
        throw AppException.from(APP_ERRORS.identity.usernameInvalid, undefined);
      }
      const owner = await this.users.findByUsername(input.username);
      if (owner && owner.id !== exceptUserId) {
        throw AppException.from(APP_ERRORS.identity.usernameTaken, undefined);
      }
    }
    if (input.email !== undefined) {
      const owner = await this.users.findByEmail(input.email);
      if (owner && owner.id !== exceptUserId) {
        throw AppException.from(APP_ERRORS.identity.emailTaken, undefined);
      }
    }
  }

  /** The unit, only when it belongs to the condominium (null: none). */
  async unitOf(
    condominiumId: string,
    unitId: string | null | undefined,
  ): Promise<string | null> {
    if (!unitId) return null;
    const unit = await this.condominiums.unitIn(condominiumId, unitId);
    if (!unit) {
      throw AppException.from(APP_ERRORS.condominiums.unitNotFound, undefined);
    }
    return unit.id;
  }

  /** "ana.souza", then "ana.souza2", "ana.souza3"… until one is free. */
  async freeUsername(fullName: string): Promise<string> {
    const base = usernameBase(fullName);
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const username = attempt === 1 ? base : `${base}${attempt}`;
      if (!isValidUsername(username)) break;
      if (!(await this.users.findByUsername(username))) return username;
    }
    // Names that don't make a valid login fall back to random digits.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const username = `morador${this.secrets.numericCode(5)}`;
      if (!(await this.users.findByUsername(username))) return username;
    }
    throw AppException.from(APP_ERRORS.identity.noUsername, undefined);
  }
}
