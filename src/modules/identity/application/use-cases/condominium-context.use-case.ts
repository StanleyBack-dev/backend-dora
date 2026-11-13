import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { CondominiumStatus } from "@/modules/condominiums/domain/condominium";
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepositoryPort,
} from "@/modules/identity/application/ports/membership-repository.port";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import type { MemberCondominium } from "@/modules/identity/domain/membership";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/** The condominium the caller is working in, as the app header shows it. */
export type CurrentCondominium = {
  id: string;
  name: string;
  city: string;
  state: string;
  status: CondominiumStatus;
};

// Which condominium a session works in. Permissions are resolved on every
// request from the session, so switching takes effect on the next call
// without new tokens.
@Injectable()
export class CondominiumContextUseCase {
  constructor(
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly memberships: MembershipRepositoryPort,
    @Inject(SESSION_REPOSITORY)
    private readonly sessions: SessionRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly condominiums: CondominiumLookupService,
  ) {}

  /** Condominiums the caller can open through a membership. */
  mine(userId: string): Promise<MemberCondominium[]> {
    return this.memberships.listOpenable(userId);
  }

  async current(
    condominiumId: string | null,
  ): Promise<CurrentCondominium | null> {
    if (!condominiumId) return null;
    const found = await this.condominiums.find(condominiumId);
    return found
      ? {
          id: found.id,
          name: found.name,
          city: found.city,
          state: found.state,
          status: found.status,
        }
      : null;
  }

  /**
   * Members open their active condominiums; the platform administrator opens
   * any (suspended ones too, to help) or none (`null`: the platform view).
   */
  async switchTo(
    user: AuthenticatedUser,
    condominiumId: string | null,
  ): Promise<void> {
    if (condominiumId === null) {
      await this.sessions.setCondominium(user.sessionId, null);
      return;
    }

    const condominium = await this.condominiums.find(condominiumId);
    if (!user.platformAdmin) {
      const membership = condominium
        ? await this.memberships.find(user.id, condominiumId)
        : null;
      if (!condominium || !membership?.active) {
        throw AppException.from(APP_ERRORS.tenancy.notMember, undefined);
      }
      if (condominium.status !== CondominiumStatus.ACTIVE) {
        throw AppException.from(
          APP_ERRORS.tenancy.condominiumSuspended,
          undefined,
        );
      }
    } else if (!condominium) {
      throw AppException.from(APP_ERRORS.condominiums.notFound, undefined);
    }

    await this.sessions.setCondominium(user.sessionId, condominiumId);
    await this.memberships.touchSelected(
      user.id,
      condominiumId,
      this.clock.now(),
    );
  }
}
