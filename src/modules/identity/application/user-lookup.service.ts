import { profileUnitId } from "@/modules/identity/domain/member-profile";
import { Inject, Injectable } from "@nestjs/common";
import type { UserGroup } from "@/modules/access-control/domain/user-group";
import {
  MEMBERSHIP_REPOSITORY,
  type MembershipRepositoryPort,
} from "@/modules/identity/application/ports/membership-repository.port";
import {
  USER_REPOSITORY,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import { MemberKind } from "@/modules/identity/domain/member-profile";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** What other modules may know about a user. */
export type UserSummary = {
  id: string;
  name: string;
  username: string;
  email: string;
  group: UserGroup;
  active: boolean;
};

/** A resident as the directory shows them (no e-mail or documents). */
export type ResidentEntry = {
  userId: string;
  membershipId: string;
  name: string;
  phone: string | null;
  avatarKey: string | null;
  unitId: string | null;
  unitStreet: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
  unitComplement: string | null;
};

// Identity's public read API for other modules (enrollment, broadcasts…), so they
// never reach into identity's tables or repositories.
@Injectable()
export class UserLookupService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly memberships: MembershipRepositoryPort,
  ) {}

  /**
   * The condominium's active residents (one page, by name), optionally one
   * person or one unit: only what the residents' directory shows.
   */
  async residents(
    condominiumId: string,
    filter: { userId?: string; unitId?: string },
    page: PageRequest,
  ): Promise<Paginated<ResidentEntry>> {
    const found = await this.users.listMembers(
      condominiumId,
      {
        kind: MemberKind.RESIDENT,
        active: true,
        userId: filter.userId,
        unitId: filter.unitId,
      },
      page,
    );
    return {
      ...found,
      items: found.items.map((member) => ({
        userId: member.id,
        membershipId: member.membershipId,
        name: member.name,
        phone: member.phone,
        avatarKey: member.avatarKey,
        unitId: member.unitId,
        unitStreet: member.unitStreet,
        unitBlock: member.unitBlock,
        unitNumber: member.unitNumber,
        unitComplement: member.unitComplement,
      })),
    };
  }

  /** The residents' names, for the directory's name filter. */
  async residentNames(
    condominiumId: string,
  ): Promise<{ id: string; name: string }[]> {
    return (
      await this.users.memberFilterOptions(condominiumId, MemberKind.RESIDENT)
    ).map(({ id, name }) => ({ id, name }));
  }

  /**
   * Members of a condominium who can be reached (active membership, active
   * account), optionally only one role (e.g. its managers).
   */
  activeMemberIds(condominiumId: string, role?: UserGroup): Promise<string[]> {
    return this.memberships.activeUserIds(condominiumId, role);
  }

  /** Residents of a unit who can be reached (e.g. told about a parcel). */
  activeUnitMemberIds(
    condominiumId: string,
    unitId: string,
  ): Promise<string[]> {
    return this.memberships.activeUnitUserIds(condominiumId, unitId);
  }

  /** Residents with a unit found by part of their name (e.g. at the gate). */
  searchResidents(
    condominiumId: string,
    term: string,
    limit: number,
  ): Promise<{ userId: string; name: string; unitId: string }[]> {
    return this.memberships.searchResidents(condominiumId, term, limit);
  }

  /** The unit of the person's active membership there (null: none). */
  async memberUnitId(
    userId: string,
    condominiumId: string,
  ): Promise<string | null> {
    const membership = await this.memberships.find(userId, condominiumId);
    return membership?.active ? profileUnitId(membership.profile) : null;
  }

  /** The account holding a membership (null: none). */
  memberUserId(membershipId: string): Promise<string | null> {
    return this.memberships.userIdOf(membershipId);
  }

  /** Whether this e-mail's account already belongs to the condominium. */
  async isMemberEmail(email: string, condominiumId: string): Promise<boolean> {
    const user = await this.users.findByEmail(email);
    return Boolean(
      user && (await this.memberships.find(user.id, condominiumId)),
    );
  }

  /** Enabled accounts of an account-level group (e.g. platform admins). */
  activeUserIdsInGroup(group: UserGroup): Promise<string[]> {
    return this.users.listActiveIds(group);
  }

  /** Whether a login name or e-mail already belongs to an account. */
  async isTaken(input: {
    username?: string;
    email?: string;
  }): Promise<boolean> {
    const [byUsername, byEmail] = await Promise.all([
      input.username ? this.users.findByUsername(input.username) : null,
      input.email ? this.users.findByEmail(input.email) : null,
    ]);
    return Boolean(byUsername ?? byEmail);
  }

  /** Object storage key of the account's profile photo (null: none). */
  async avatarKeyOf(id: string): Promise<string | null> {
    return (await this.users.findById(id))?.avatarKey ?? null;
  }

  /** Photo keys of many accounts at once (lists of people). */
  avatarKeysOf(ids: readonly string[]): Promise<Map<string, string>> {
    return this.users.avatarKeys(ids);
  }

  /** Profile photo of an account (key in the object storage). */
  async setAvatarKey(id: string, avatarKey: string | null): Promise<void> {
    await this.users.update(id, { avatarKey });
  }

  /** Contact phone of the account, digits only (null: none). */
  async phoneOf(id: string): Promise<string | null> {
    return (await this.users.findById(id))?.phone ?? null;
  }

  /** YYYY-MM-DD, or null when not informed. */
  async birthDateOf(id: string): Promise<string | null> {
    return (await this.users.findById(id))?.birthDate ?? null;
  }

  /** Whether the person already saw (or skipped) the guided tour. */
  async onboardingCompleted(id: string): Promise<boolean> {
    return Boolean((await this.users.findById(id))?.onboardingCompletedAt);
  }

  /** Marks the guided tour as seen (the first time only). */
  async completeOnboarding(id: string): Promise<void> {
    if (await this.onboardingCompleted(id)) return;
    await this.users.update(id, { onboardingCompletedAt: new Date() });
  }

  async findById(id: string): Promise<UserSummary | null> {
    const user = await this.users.findById(id);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      group: user.group,
      active: user.active,
    };
  }
}
