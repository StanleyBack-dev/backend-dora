// Access profile. USER and ADMIN are roles inside a condominium (resident and
// manager, kept on the membership); ADMIN_MASTER runs the platform (kept on
// the account) and acts as the top rank in any condominium. Each group grants
// a default set of permissions (group-permissions.ts) and has a rank used to
// decide who manages whom.
export enum UserGroup {
  USER = "USER",
  ADMIN = "ADMIN",
  ADMIN_MASTER = "ADMIN_MASTER",
}

export const GROUP_RANK: Record<UserGroup, number> = {
  [UserGroup.USER]: 1,
  [UserGroup.ADMIN]: 2,
  [UserGroup.ADMIN_MASTER]: 3,
};

/** Roles a membership can have (ADMIN_MASTER is never a membership role). */
export const MEMBER_ROLES: readonly UserGroup[] = [
  UserGroup.USER,
  UserGroup.ADMIN,
];

export const isMemberRole = (group: UserGroup): boolean =>
  MEMBER_ROLES.includes(group);
