import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  ACCESS_TOKEN,
  type AccessTokenPort,
} from "@/modules/identity/application/ports/access-token.port";
import {
  PRINCIPAL_READER,
  type PrincipalReaderPort,
} from "@/modules/identity/application/ports/principal-reader.port";
import { resolveTenantContext } from "@/modules/identity/domain/membership";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { isLive } from "@/modules/identity/application/session-liveness";

/** Resolves the caller of every request (used by the session guard). */
@Injectable()
export class AuthenticateUseCase {
  constructor(
    @Inject(ACCESS_TOKEN) private readonly accessTokens: AccessTokenPort,
    @Inject(PRINCIPAL_READER) private readonly principals: PrincipalReaderPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    accessToken: string | null,
    ipAddress: string | null,
  ): Promise<AuthenticatedUser> {
    if (!accessToken) {
      throw AppException.from(APP_ERRORS.identity.sessionMissing, undefined);
    }
    const verified = this.accessTokens.verify(accessToken);
    if (verified.status === "expired") {
      throw AppException.from(APP_ERRORS.identity.tokenExpired, undefined);
    }
    if (verified.status === "invalid") {
      throw AppException.from(APP_ERRORS.identity.sessionMissing, undefined);
    }

    const { userId, sessionId } = verified.claims;
    const principal = await this.principals.findBySession(sessionId);
    if (
      !principal ||
      principal.userId !== userId ||
      !isLive(principal, this.clock.now())
    ) {
      throw AppException.from(APP_ERRORS.identity.sessionInvalid, undefined);
    }
    if (!principal.active) {
      throw AppException.from(APP_ERRORS.identity.userInactive, undefined);
    }

    const context = resolveTenantContext(principal.tenant);
    return {
      id: principal.userId,
      sessionId: principal.sessionId,
      name: principal.name,
      username: principal.username,
      email: principal.email,
      group: context.group,
      platformAdmin: context.platformAdmin,
      condominiumId: context.condominiumId,
      membershipId: context.membershipId,
      mustChangePassword: principal.mustChangePassword,
      ipAddress,
    };
  }
}
