import type { PermissionOverride } from "@/modules/access-control/domain/permission-policy";

export interface PermissionOverrideRepositoryPort {
  findByMembership(membershipId: string): Promise<PermissionOverride[]>;
  /** Atomically swaps the membership's overrides for `overrides`. */
  replaceForMembership(
    membershipId: string,
    overrides: readonly PermissionOverride[],
  ): Promise<void>;
}

export const PERMISSION_OVERRIDE_REPOSITORY = Symbol(
  "PERMISSION_OVERRIDE_REPOSITORY",
);
