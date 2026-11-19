import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import {
  USER_REPOSITORY,
  type MemberAccount,
  type MemberFilterOption,
  type MemberStats,
  type UserFilter,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
import type { MemberKind } from "@/modules/identity/domain/member-profile";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { UserManagementPolicy } from "@/modules/identity/application/user-management.policy";

@Injectable()
export class UserDirectoryUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    private readonly policy: UserManagementPolicy,
  ) {}

  list(
    actor: AuthenticatedUser,
    filter: UserFilter,
    page: PageRequest,
  ): Promise<Paginated<MemberAccount>> {
    return this.users.listMembers(tenantOf(actor), filter, page);
  }

  /** What the list's name, e-mail and phone filters offer. */
  filterOptions(
    actor: AuthenticatedUser,
    kind: MemberKind,
  ): Promise<MemberFilterOption[]> {
    return this.users.memberFilterOptions(tenantOf(actor), kind);
  }

  /** The members of one tie at a glance (the list page's cards). */
  stats(actor: AuthenticatedUser, kind: MemberKind): Promise<MemberStats> {
    return this.users.memberStats(tenantOf(actor), kind);
  }

  get(actor: AuthenticatedUser, id: string): Promise<MemberAccount> {
    return this.policy.loadMember(tenantOf(actor), id);
  }
}
