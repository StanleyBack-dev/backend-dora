import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import {
  USER_REPOSITORY,
  type MemberAccount,
  type UserFilter,
  type UserRepositoryPort,
} from "@/modules/identity/application/ports/user-repository.port";
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

  get(actor: AuthenticatedUser, id: string): Promise<MemberAccount> {
    return this.policy.loadMember(tenantOf(actor), id);
  }
}
