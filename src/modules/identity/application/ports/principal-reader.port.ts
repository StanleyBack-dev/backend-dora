import type { UserGroup } from "@/modules/access-control/domain/user-group";
import type { SessionTenant } from "@/modules/identity/domain/membership";

// Everything the session guard needs, read in a single query (the API runs
// on serverless functions: one round trip per request matters).
export type Principal = {
  sessionId: string;
  sessionRevokedAt: Date | null;
  sessionExpiresAt: Date;
  userId: string;
  name: string;
  username: string;
  email: string;
  /** Account-level group: ADMIN_MASTER (platform) or USER. */
  group: UserGroup;
  active: boolean;
  mustChangePassword: boolean;
  /** The session's condominium and the caller's membership there. */
  tenant: SessionTenant;
};

export interface PrincipalReaderPort {
  findBySession(sessionId: string): Promise<Principal | null>;
}

export const PRINCIPAL_READER = Symbol("PRINCIPAL_READER");
