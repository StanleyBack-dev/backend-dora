import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  PERMISSION_OVERRIDE_REPOSITORY,
  type PermissionOverrideRepositoryPort,
} from "@/modules/access-control/application/ports/permission-override-repository.port";
import type { Permission } from "@/modules/access-control/domain/permission";
import {
  planOverrides,
  resolvePermissionMatrix,
  type PermissionMatrix,
} from "@/modules/access-control/domain/permission-policy";
import type { UserGroup } from "@/modules/access-control/domain/user-group";

/**
 * Whose permissions: the group someone has in the current context and the
 * membership that holds their overrides (null outside a condominium, where
 * only the group's defaults apply).
 */
export type PermissionSubject = {
  membershipId: string | null;
  group: UserGroup;
};

// The access-control module's public API. It knows nothing about users
// beyond membership + group: who may change whose access is decided by the
// caller (identity module) with the management policy from this module's
// domain.
@Injectable()
export class PermissionsService {
  constructor(
    @Inject(PERMISSION_OVERRIDE_REPOSITORY)
    private readonly overrides: PermissionOverrideRepositoryPort,
  ) {}

  async matrixFor(subject: PermissionSubject): Promise<PermissionMatrix> {
    return resolvePermissionMatrix(
      subject.group,
      subject.membershipId
        ? await this.overrides.findByMembership(subject.membershipId)
        : [],
    );
  }

  // The request's user object lives for one request: the guard and every
  // field resolver of that request share one lookup.
  private readonly perRequest = new WeakMap<
    PermissionSubject,
    Promise<ReadonlySet<Permission>>
  >();

  effectiveFor(subject: PermissionSubject): Promise<ReadonlySet<Permission>> {
    let found = this.perRequest.get(subject);
    if (!found) {
      found = this.matrixFor(subject).then(
        (matrix) => new Set(matrix.effective),
      );
      this.perRequest.set(subject, found);
      // A failed lookup is not remembered.
      found.catch(() => this.perRequest.delete(subject));
    }
    return found;
  }

  /** `desired = null` drops every override (back to the group defaults). */
  async replace(
    subject: { membershipId: string; group: UserGroup },
    desired: readonly Permission[] | null,
  ): Promise<PermissionMatrix> {
    if (desired === null) {
      await this.overrides.replaceForMembership(subject.membershipId, []);
      return resolvePermissionMatrix(subject.group, []);
    }

    const plan = planOverrides(subject.group, desired);
    if (!plan.ok) {
      throw AppException.from(
        APP_ERRORS.accessControl.lockedPermissions,
        undefined,
        { permissions: plan.lockedChanges },
      );
    }
    await this.overrides.replaceForMembership(
      subject.membershipId,
      plan.overrides,
    );
    return resolvePermissionMatrix(subject.group, plan.overrides);
  }

  /**
   * Called when a member changes role: overrides were exceptions to the old
   * role's defaults, so they are dropped and the new role's defaults apply.
   */
  async resetToGroupDefaults(membershipId: string): Promise<void> {
    await this.overrides.replaceForMembership(membershipId, []);
  }
}
