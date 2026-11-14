import { Permission } from "@/modules/access-control/domain/permission";
import type { StampedEntity } from "@/modules/audit/domain/record-stamp";

/**
 * Whose stamps a member may read (the platform administrator reads all):
 * - condominium: records of the session's condominium;
 * - member: accounts that belong to the session's condominium;
 * - owner: the person's own records (support requests).
 */
export type StampScope = "condominium" | "member" | "owner";

export const STAMP_SCOPE: Record<StampedEntity, StampScope> = {
  user: "member",
  membership: "condominium",
  condominium: "condominium",
  unit: "condominium",
  space: "condominium",
  booking: "condominium",
  space_block: "condominium",
  broadcast: "condominium",
  enrollment_invite: "condominium",
  enrollment_request: "condominium",
  support_request: "owner",
};

/** Who reads a stamp; the platform administrator is not limited. */
export type StampViewer =
  | { platform: true }
  | { platform: false; userId: string; condominiumId: string | null };

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
