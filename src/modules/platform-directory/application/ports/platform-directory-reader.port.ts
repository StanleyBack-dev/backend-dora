import type { UserGroup } from "@/modules/access-control/domain/user-group";
import type { MemberKind } from "@/modules/identity/domain/member-profile";
import type { PeopleFilter } from "@/modules/platform-directory/domain/people-filter";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** A person's access to one condominium. */
export type PersonMembership = {
  condominiumId: string;
  condominiumName: string;
  role: UserGroup;
  kind: MemberKind;
  active: boolean;
};

/** Someone with an account, across every condominium. */
export type PlatformPerson = {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  /** Runs the platform (ADMIN_MASTER). */
  platformAdmin: boolean;
  /** The account is on (off: nobody signs in with it). */
  active: boolean;
  /** Too many wrong passwords: blocked until then. */
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  memberships: PersonMembership[];
};

/** A member of one condominium, as the platform sees it. */
export type CondominiumMember = {
  userId: string;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  role: UserGroup;
  kind: MemberKind;
  /** Access to this condominium. */
  active: boolean;
  /** Residents: "Bloco A · 101" (null: none). */
  unitLabel: string | null;
  /** Employees: the job (null: none). */
  jobTitle: string | null;
  lastLoginAt: Date | null;
  since: Date;
};

export const PLATFORM_DIRECTORY_READER = Symbol("PLATFORM_DIRECTORY_READER");

export interface PlatformDirectoryReaderPort {
  /** Everyone with an account (by name), with their condominiums. */
  people(
    filter: PeopleFilter,
    page: PageRequest,
  ): Promise<Paginated<PlatformPerson>>;
  /** The members of a condominium: managers, the gate, then residents. */
  membersOf(condominiumId: string): Promise<CondominiumMember[]>;
}
