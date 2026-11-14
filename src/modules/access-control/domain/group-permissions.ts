import { ALL_PERMISSIONS, Permission } from "./permission";
import { UserGroup } from "./user-group";

// Residents: what every member has (home, profile, notifications, support)
// plus booking spaces.
const RESIDENT_DEFAULTS: Permission[] = [Permission.BOOKINGS_CREATE];

// Managers (síndico, administration) run their own condominium: overview,
// announcements, members and sign-ups, units, spaces and members'
// permissions.
const MANAGER_DEFAULTS: Permission[] = [
  ...RESIDENT_DEFAULTS,
  Permission.DASHBOARD_READ,
  Permission.NOTIFICATIONS_BROADCAST,
  Permission.USERS_MANAGE,
  Permission.PERMISSIONS_MANAGE,
  Permission.UNITS_MANAGE,
  Permission.SPACES_MANAGE,
  Permission.BOOKINGS_MANAGE,
];

export const GROUP_DEFAULT_PERMISSIONS: Record<
  UserGroup,
  readonly Permission[]
> = {
  [UserGroup.USER]: RESIDENT_DEFAULTS,
  [UserGroup.ADMIN]: MANAGER_DEFAULTS,
  [UserGroup.ADMIN_MASTER]: ALL_PERMISSIONS,
};

// Only ever granted by the group: a per-member override can neither grant
// nor revoke them. Managing members and their permissions comes with the
// manager role; record history, support and condominiums stay with the
// platform (ADMIN_MASTER).
export const LOCKED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.USERS_MANAGE,
  Permission.PERMISSIONS_MANAGE,
  Permission.AUDIT_READ,
  Permission.SUPPORT_MANAGE,
  Permission.CONDOMINIUMS_MANAGE,
]);
