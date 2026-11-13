import type { Request } from "express";
import type { UserGroup } from "@/modules/access-control/domain/user-group";

// Who is calling, as established by the session guard (identity module) and
// read by the permission guard and by resolvers via @CurrentUser().
export type AuthenticatedUser = {
  id: string;
  sessionId: string;
  name: string;
  username: string;
  email: string;
  /**
   * Group in the current context: the role in the session's condominium,
   * ADMIN_MASTER for the platform administrator, USER outside a condominium.
   */
  group: UserGroup;
  /** Runs the platform (account-level ADMIN_MASTER). */
  platformAdmin: boolean;
  /** The condominium this session works in (null: none chosen/available). */
  condominiumId: string | null;
  /** The caller's membership there (null: none, e.g. the platform admin). */
  membershipId: string | null;
  mustChangePassword: boolean;
  /** End user's address as forwarded by the BFF (for the audit trail). */
  ipAddress: string | null;
};

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
