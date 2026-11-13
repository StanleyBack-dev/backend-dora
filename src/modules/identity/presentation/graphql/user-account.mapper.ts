import { UserGroup } from "@/modules/access-control/domain/user-group";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import type { MemberAccount } from "@/modules/identity/application/ports/user-repository.port";
import { type TemporaryAccess } from "@/modules/identity/application/use-cases/manage-users.use-case";
import type { TemporaryAccessType } from "@/modules/identity/presentation/graphql/dto/outputs/temporary-access.output";
import type { UserAccountType } from "@/modules/identity/presentation/graphql/dto/outputs/user-account.output";

/** A member as the condominium's managers see them. */
export function toAccountType(member: MemberAccount): UserAccountType {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    username: member.username,
    // The platform administrator shows as such wherever they are a member.
    group:
      member.group === UserGroup.ADMIN_MASTER
        ? UserGroup.ADMIN_MASTER
        : member.role,
    active: member.membershipActive && member.active,
    unitId: member.unitId,
    unitLabel:
      member.unitNumber !== null
        ? unitLabel({
            block: member.unitBlock ?? "",
            number: member.unitNumber,
          })
        : null,
    sharedAccount: member.sharedAccount,
    mustChangePassword: member.mustChangePassword,
    lockedUntil: member.lockedUntil,
    lastLoginAt: member.lastLoginAt,
    deactivatedAt: member.deactivatedAt,
    createdAt: member.createdAt,
  };
}

export const toAccessType = (access: TemporaryAccess): TemporaryAccessType => ({
  ...access,
  user: toAccountType(access.user),
});
