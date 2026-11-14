import { Permission } from "@/modules/access-control/domain/permission";
import type { StampedEntity } from "@/modules/audit/domain/record-stamp";

// Records whose page is not for everyone keep the same rule here.
export const STAMP_READ_PERMISSION: Partial<Record<StampedEntity, Permission>> =
  {
    user: Permission.USERS_MANAGE,
    membership: Permission.USERS_MANAGE,
    enrollment_invite: Permission.USERS_MANAGE,
    enrollment_request: Permission.USERS_MANAGE,
    broadcast: Permission.NOTIFICATIONS_BROADCAST,
    unit: Permission.UNITS_MANAGE,
    space: Permission.SPACES_MANAGE,
    booking: Permission.BOOKINGS_MANAGE,
    space_block: Permission.BOOKINGS_MANAGE,
    condominium: Permission.CONDOMINIUMS_MANAGE,
  };
