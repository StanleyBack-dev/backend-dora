import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import type { AppModule } from "@/modules/condominiums/domain/app-module";
import {
  AddressFormat,
  CondominiumStatus,
} from "@/modules/condominiums/domain/condominium";
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepositoryPort,
} from "@/modules/identity/application/ports/membership-repository.port";
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from "@/modules/identity/application/ports/session-repository.port";
import type { MemberCondominium } from "@/modules/identity/domain/membership";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import type { User } from "@/modules/identity/domain/user";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/** The condominium the caller is working in, as the app header shows it. */
export type CurrentCondominium = {
  id: string;
  name: string;
  city: string;
  state: string;
  status: CondominiumStatus;
  /** Apartments or houses: how its homes are identified. */
  addressFormat: AddressFormat;
  /** Optional modules contracted apart that are on (e.g. events). */
  modules: AppModule[];
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
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly condominiums: CondominiumLookupService,
    private readonly modules: ModuleAccessService,
  ) {}

  /**
   * Condominiums the caller can open: their memberships, or every
   * condominium for the platform administrator.
   */
  async mine(user: {
    id: string;
    platformAdmin: boolean;
  }): Promise<MemberCondominium[]> {
    if (!user.platformAdmin) return this.memberships.listOpenable(user.id);
    return (await this.condominiums.listAll()).map((condominium) => ({
      id: condominium.id,
      name: condominium.name,
      city: condominium.city,
      state: condominium.state,
      role: UserGroup.ADMIN_MASTER,
    }));
  }

  /**
   * Where a new session starts: the condominium used last, while the person
   * can still enter it; otherwise the most recent active membership (the
   * platform administrator: the platform view).
   */
  async startingFor(
    user: Pick<User, "id" | "group" | "lastCondominiumId">,
  ): Promise<{ id: string; status: CondominiumStatus } | null> {
    const platformAdmin = user.group === UserGroup.ADMIN_MASTER;
    if (user.lastCondominiumId) {
      const last = await this.condominiums.find(user.lastCondominiumId);
      if (last && platformAdmin) return { id: last.id, status: last.status };
      if (last?.status === CondominiumStatus.ACTIVE) {
        const membership = await this.memberships.find(user.id, last.id);
        if (membership?.active) return { id: last.id, status: last.status };
      }
    }
    if (platformAdmin) return null;
    const fallback = await this.memberships.defaultCondominiumId(user.id);
    return fallback ? { id: fallback, status: CondominiumStatus.ACTIVE } : null;
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
          addressFormat: found.addressFormat,
          modules: await this.modules.enabled(found.id),
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
      // Remembered too: the platform view is a choice like any other.
      await this.users.update(user.id, { lastCondominiumId: null });
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
    // The next login (after logging out or losing the session) reopens it.
    await this.users.update(user.id, { lastCondominiumId: condominiumId });
    await this.memberships.touchSelected(
      user.id,
      condominiumId,
      this.clock.now(),
    );
  }
}
