import { ALL_PERMISSIONS, Permission } from "./permission";
import { UserGroup } from "./user-group";

// Residents: for now only what every signed-in account already has (home,
// profile, notifications, support). The bookings module grants theirs here.
const RESIDENT_DEFAULTS: Permission[] = [];

// Managers (síndico, administration): the overview and announcements.
// Accounts, sign-ups, permissions and record history stay with ADMIN_MASTER.
const MANAGER_DEFAULTS: Permission[] = [
  ...RESIDENT_DEFAULTS,
  Permission.DASHBOARD_READ,
  Permission.NOTIFICATIONS_BROADCAST,
];

export const GROUP_DEFAULT_PERMISSIONS: Record<
  UserGroup,
  readonly Permission[]
> = {
  [UserGroup.USER]: RESIDENT_DEFAULTS,
  [UserGroup.ADMIN]: MANAGER_DEFAULTS,
  [UserGroup.ADMIN_MASTER]: ALL_PERMISSIONS,
};

// Only ever granted by the group: a per-user override can neither grant nor
// revoke them. Accounts, sign-ups, permissions, record history and answering
// support requests stay with ADMIN_MASTER.
export const LOCKED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.USERS_MANAGE,
  Permission.PERMISSIONS_MANAGE,
  Permission.AUDIT_READ,
  Permission.SUPPORT_MANAGE,
]);
