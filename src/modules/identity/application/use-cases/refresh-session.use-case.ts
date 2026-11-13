import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  PRINCIPAL_READER,
  type PrincipalReaderPort,
} from "@/modules/identity/application/ports/principal-reader.port";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import {
  SessionTokensService,
  type IssuedTokens,
} from "@/modules/identity/application/session-tokens.service";
import { parseRefreshToken } from "@/modules/identity/domain/refresh-token";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { isLive } from "@/modules/identity/application/session-liveness";

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(PRINCIPAL_READER) private readonly principals: PrincipalReaderPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly sessionTokens: SessionTokensService,
  ) {}

  async execute(refreshToken: string): Promise<IssuedTokens> {
    const parsed = parseRefreshToken(refreshToken);
    const session = parsed
      ? await this.sessions.findById(parsed.sessionId)
      : null;

    if (
      !parsed ||
      !session ||
      !this.secrets.sameDigest(
        this.secrets.digest(parsed.secret),
        session.refreshSecretHash,
      )
    ) {
      throw AppException.from(APP_ERRORS.identity.refreshInvalid, undefined);
    }

    const principal = await this.principals.findBySession(session.id);
    if (!principal || !isLive(principal, this.clock.now())) {
      throw AppException.from(APP_ERRORS.identity.refreshInvalid, undefined);
    }
    if (!principal.active) {
      throw AppException.from(APP_ERRORS.identity.userInactive, undefined);
    }

    return this.sessionTokens.extend(session.userId, session.id, parsed.secret);
  }
}
