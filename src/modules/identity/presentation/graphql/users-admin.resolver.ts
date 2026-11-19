import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import type { PermissionMatrix } from "@/modules/access-control/domain/permission-policy";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { PermissionMatrixType } from "@/modules/access-control/presentation/graphql/dto/outputs/permission-matrix.output";
import { ManageUsersUseCase } from "@/modules/identity/application/use-cases/manage-users.use-case";
import { UserDirectoryUseCase } from "@/modules/identity/application/use-cases/user-directory.use-case";
import { UserPermissionsUseCase } from "@/modules/identity/application/use-cases/user-permissions.use-case";
import { CreateUserInput } from "@/modules/identity/presentation/graphql/dto/inputs/create-user.input";
import { SetUserPermissionsInput } from "@/modules/identity/presentation/graphql/dto/inputs/set-user-permissions.input";
import { MemberKind } from "@/modules/identity/domain/member-profile";
import { MemberStatsType } from "@/modules/identity/presentation/graphql/dto/outputs/member-stats.output";
import { MemberFilterOptionType } from "@/modules/identity/presentation/graphql/dto/outputs/member-filter-option.output";
import "@/modules/identity/presentation/graphql/identity.graphql-enums";
import { TemporaryAccessType } from "@/modules/identity/presentation/graphql/dto/outputs/temporary-access.output";
import { UpdateUserInput } from "@/modules/identity/presentation/graphql/dto/inputs/update-user.input";
import { UserAccountPage } from "@/modules/identity/presentation/graphql/dto/outputs/user-account-page.output";
import { UserAccountType } from "@/modules/identity/presentation/graphql/dto/outputs/user-account.output";
import { UserFilterInput } from "@/modules/identity/presentation/graphql/dto/inputs/user-filter.input";
import type { Paginated } from "@/shared/application/pagination";
import {
  toAccountType,
  toAccessType,
} from "@/modules/identity/presentation/graphql/user-account.mapper";

// Members of the session's condominium. Every operation is scoped to it by
// the use cases (the condominium comes from the session, never the input).
@Resolver()
export class UsersAdminResolver {
  constructor(
    private readonly directory: UserDirectoryUseCase,
    private readonly manage: ManageUsersUseCase,
    private readonly permissionsUseCase: UserPermissionsUseCase,
  ) {}

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => UserAccountPage, { description: "Membros do condomínio." })
  async users(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: UserFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<UserAccountType>> {
    const found = await this.directory.list(
      actor,
      filter ?? {},
      page ?? { page: 1, limit: 20 },
    );
    return { ...found, items: found.items.map(toAccountType) };
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => [MemberFilterOptionType], {
    description:
      "Os membros de um vínculo (moradores ou funcionários), para os filtros de nome, e-mail e telefone.",
  })
  memberFilterOptions(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("kind", { type: () => MemberKind }) kind: MemberKind,
  ): Promise<MemberFilterOptionType[]> {
    return this.directory.filterOptions(actor, kind);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => MemberStatsType, {
    description: "Os membros de um vínculo em números (cards da página).",
  })
  memberStats(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("kind", { type: () => MemberKind }) kind: MemberKind,
  ): Promise<MemberStatsType> {
    return this.directory.stats(actor, kind);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => UserAccountType)
  async user(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<UserAccountType> {
    return toAccountType(await this.directory.get(actor, id));
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => TemporaryAccessType, {
    description:
      "Adiciona ao condomínio. Conta nova: senha temporária (também por e-mail). E-mail já cadastrado: só ganha acesso.",
  })
  async createUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateUserInput,
  ): Promise<TemporaryAccessType> {
    return toAccessType(await this.manage.create(actor, input));
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => UserAccountType)
  async updateUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: UpdateUserInput,
  ): Promise<UserAccountType> {
    return toAccountType(await this.manage.update(actor, id, input));
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => UserAccountType, {
    description:
      "Ativa ou desativa o acesso a este condomínio (a conta e outros condomínios não mudam).",
  })
  async setUserActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("active") active: boolean,
  ): Promise<UserAccountType> {
    return toAccountType(await this.manage.setActive(actor, id, active));
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => TemporaryAccessType, {
    description: "Gera nova senha temporária e encerra as sessões do usuário.",
  })
  async resetUserPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<TemporaryAccessType> {
    return toAccessType(await this.manage.resetPassword(actor, id));
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => UserAccountType)
  async unlockUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<UserAccountType> {
    return toAccountType(await this.manage.unlock(actor, id));
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => UserAccountType)
  async revokeUserSessions(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<UserAccountType> {
    return toAccountType(await this.manage.revokeSessions(actor, id));
  }

  @RequirePermissions(Permission.PERMISSIONS_MANAGE)
  @Query(() => PermissionMatrixType)
  userPermissions(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<PermissionMatrix> {
    return this.permissionsUseCase.get(actor, id);
  }

  @RequirePermissions(Permission.PERMISSIONS_MANAGE)
  @Mutation(() => PermissionMatrixType)
  setUserPermissions(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: SetUserPermissionsInput,
  ): Promise<PermissionMatrix> {
    return this.permissionsUseCase.set(
      actor,
      input.userId,
      input.useGroupDefaults ? null : (input.permissions ?? []),
    );
  }
}
