import { UserGroup } from "@/modules/access-control/domain/user-group";

/**
 * A person's place in a condominium: their role there (resident or manager)
 * and their unit. One account can belong to many condominiums.
 */
export type Membership = {
  id: string;
  userId: string;
  condominiumId: string;
  /** USER (resident) or ADMIN (manager). */
  role: UserGroup;
  unitId: string | null;
  active: boolean;
  lastSelectedAt: Date | null;
  createdAt: Date;
};

/** A condominium the person can open, as the switcher lists it. */
export type MemberCondominium = {
  id: string;
  name: string;
  city: string;
  state: string;
  role: UserGroup;
};

/** What the session guard reads about the session's condominium. */
export type SessionTenant = {
  /** Account-level group: ADMIN_MASTER (platform) or USER. */
  accountGroup: UserGroup;
  condominiumId: string | null;
  /** Null when the condominium no longer exists. */
  condominiumStatus: "ACTIVE" | "SUSPENDED" | null;
  /** The caller's active membership there (null: none). */
  membershipId: string | null;
  membershipRole: UserGroup | null;
};

export type TenantContext = {
  group: UserGroup;
  platformAdmin: boolean;
  condominiumId: string | null;
  membershipId: string | null;
};

/**
 * Who the caller is in this request. The platform administrator works in any
 * condominium (suspended ones too) with every permission; anyone else needs
 * an active membership in an active condominium, and gets their role there.
 * Without one, they are a plain USER with no condominium (profile, support
 * and switching condominiums still work).
 */
export function resolveTenantContext(tenant: SessionTenant): TenantContext {
  const platformAdmin = tenant.accountGroup === UserGroup.ADMIN_MASTER;
  const outside: TenantContext = {
    group: platformAdmin ? UserGroup.ADMIN_MASTER : UserGroup.USER,
    platformAdmin,
    condominiumId: null,
    membershipId: null,
  };
  if (!tenant.condominiumId || !tenant.condominiumStatus) return outside;

  if (platformAdmin) {
    // Acts as the platform, not as a member: no per-member overrides.
    return { ...outside, condominiumId: tenant.condominiumId };
  }
  if (
    tenant.condominiumStatus === "ACTIVE" &&
    tenant.membershipId &&
    tenant.membershipRole
  ) {
    return {
      group: tenant.membershipRole,
      platformAdmin: false,
      condominiumId: tenant.condominiumId,
      membershipId: tenant.membershipId,
    };
  }
  return outside;
}
