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

/** What other modules may know about a user. */
export type UserSummary = {
  id: string;
  name: string;
  username: string;
  email: string;
  group: UserGroup;
  active: boolean;
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
   * Members of a condominium who can be reached (active membership, active
   * account), optionally only one role (e.g. its managers).
   */
  activeMemberIds(condominiumId: string, role?: UserGroup): Promise<string[]> {
    return this.memberships.activeUserIds(condominiumId, role);
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
