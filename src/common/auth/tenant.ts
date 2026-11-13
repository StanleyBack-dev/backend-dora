import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";

/**
 * The condominium every tenant-scoped operation works in. It always comes
 * from the session (never from the client), so a member of one condominium
 * can't read or change another's data by sending a different id.
 */
export function tenantOf(user: AuthenticatedUser): string {
  if (!user.condominiumId) {
    throw AppException.from(APP_ERRORS.tenancy.noCondominium, undefined);
  }
  return user.condominiumId;
}
