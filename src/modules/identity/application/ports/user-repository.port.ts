import type { UserGroup } from "@/modules/access-control/domain/user-group";
import type { NewMembership } from "@/modules/identity/application/ports/membership-repository.port";
import type { User } from "@/modules/identity/domain/user";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

export type NewUser = {
  name: string;
  email: string;
  username: string;
  group: UserGroup;
};

export type UserPatch = Partial<
  Pick<
    User,
    | "name"
    | "email"
    | "username"
    | "group"
    | "active"
    | "avatarKey"
    | "onboardingCompletedAt"
  >
>;

export type UserFilter = {
  /** Matches name, username or e-mail (case-insensitive). */
  search?: string;
  /** Role in the condominium. */
  group?: UserGroup;
  /** Membership active (and account active). */
  active?: boolean;
  unitId?: string;
};

/** A user plus its login state, as the admin area shows it. */
export type UserAccount = User & {
  mustChangePassword: boolean;
  lockedUntil: Date | null;
};

/** A member of a condominium, as its managers see them. */
export type MemberAccount = UserAccount & {
  membershipId: string;
  /** Role in this condominium (`group` stays the account-level group). */
  role: UserGroup;
  membershipActive: boolean;
  unitId: string | null;
  unitBlock: string | null;
  unitNumber: string | null;
  /**
   * The account is also used outside this condominium (another membership,
   * or the platform administrator): its login data is not this
   * condominium's to change.
   */
  sharedAccount: boolean;
};

export type NewCredential = {
  passwordHash: string;
  mustChangePassword: boolean;
};

export interface UserRepositoryPort {
  findById(id: string): Promise<User | null>;
  /** By username, or by e-mail when `login` contains "@". */
  findByLogin(login: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  listMembers(
    condominiumId: string,
    filter: UserFilter,
    page: PageRequest,
  ): Promise<Paginated<MemberAccount>>;
  findMember(
    condominiumId: string,
    userId: string,
  ): Promise<MemberAccount | null>;
  countActiveInGroup(group: UserGroup): Promise<number>;
  /** Profile photo keys of these users (only those with a photo). */
  avatarKeys(ids: readonly string[]): Promise<Map<string, string>>;
  /** Ids of every enabled account (only those of `group`, when given). */
  listActiveIds(group?: UserGroup): Promise<string[]>;
  /** User, credential and (optionally) a membership in one transaction. */
  createWithCredential(
    user: NewUser,
    credential: NewCredential,
    membership?: Omit<NewMembership, "userId">,
  ): Promise<User>;
  update(id: string, patch: UserPatch): Promise<User>;
  touchLastLogin(id: string, at: Date): Promise<void>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
