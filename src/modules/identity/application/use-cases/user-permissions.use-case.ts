import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import type { Permission } from "@/modules/access-control/domain/permission";
import { type PermissionMatrix } from "@/modules/access-control/domain/permission-policy";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { UserManagementPolicy } from "@/modules/identity/application/user-management.policy";

@Injectable()
export class UserPermissionsUseCase {
  constructor(
    private readonly policy: UserManagementPolicy,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditTrailService,
  ) {}

  async get(
    actor: AuthenticatedUser,
    userId: string,
  ): Promise<PermissionMatrix> {
    const member = await this.policy.loadMember(tenantOf(actor), userId);
    return this.permissions.matrixFor({
      membershipId: member.membershipId,
      group: member.role,
    });
  }

  /** `desired = null` restores the role's defaults. */
  async set(
    actor: AuthenticatedUser,
    userId: string,
    desired: Permission[] | null,
  ): Promise<PermissionMatrix> {
    const target = await this.policy.loadManageable(actor, userId);
    const after = await this.permissions.replace(
      { membershipId: target.membershipId, group: target.role },
      desired,
    );
    await this.audit.stamp({
      actorId: actor.id,
      entity: "membership",
      entityId: target.membershipId,
    });
    return after;
  }
}
