import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { tenantOf } from "@/common/auth/tenant";

// Dependents belong to a resident's membership: the caller needs one in the
// condominium of the session (the platform administrator has none).
@Injectable()
export class DependentAccessService {
  membershipOf(actor: AuthenticatedUser): {
    condominiumId: string;
    membershipId: string;
  } {
    const condominiumId = tenantOf(actor);
    if (!actor.membershipId) {
      throw AppException.from(APP_ERRORS.dependents.noMembership, undefined);
    }
    return { condominiumId, membershipId: actor.membershipId };
  }
}
