import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { EnrollmentInvitesUseCase } from "@/modules/enrollment/application/use-cases/enrollment-invites.use-case";
import { EnrollmentReviewUseCase } from "@/modules/enrollment/application/use-cases/enrollment-review.use-case";
import type { EnrollmentInvite } from "@/modules/enrollment/domain/enrollment";
import { CreateEnrollmentInviteInput } from "@/modules/enrollment/presentation/graphql/dto/inputs/create-enrollment-invite.input";
import { EnrollmentApprovalType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-approval.output";
import { EnrollmentDataInput } from "@/modules/enrollment/presentation/graphql/dto/inputs/enrollment-data.input";
import { EnrollmentInviteType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-invite.output";
import { EnrollmentRequestFilterInput } from "@/modules/enrollment/presentation/graphql/dto/inputs/enrollment-request-filter.input";
import { EnrollmentRequestPage } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-request-page.output";
import { EnrollmentRequestType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-request.output";
import { toAccountType } from "@/modules/identity/presentation/graphql/user-account.mapper";
import type { Paginated } from "@/shared/application/pagination";
import { toRequestType } from "@/modules/enrollment/presentation/graphql/enrollment-request.mapper";
import "@/modules/access-control/presentation/graphql/access-control.graphql-enums";

// Manager side: invites and review of the requests. Approving creates an
// account, so it needs users management.
@Resolver()
export class EnrollmentAdminResolver {
  constructor(
    private readonly invites: EnrollmentInvitesUseCase,
    private readonly review: EnrollmentReviewUseCase,
  ) {}

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => [EnrollmentInviteType])
  enrollmentInvites(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<EnrollmentInvite[]> {
    return this.invites.list(actor);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => EnrollmentInviteType)
  createEnrollmentInvite(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CreateEnrollmentInviteInput,
  ): Promise<EnrollmentInvite> {
    return this.invites.create(actor, input);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => EnrollmentInviteType)
  revokeEnrollmentInvite(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<EnrollmentInvite> {
    return this.invites.revoke(actor, id);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => EnrollmentRequestPage)
  async enrollmentRequests(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: EnrollmentRequestFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<EnrollmentRequestType>> {
    const found = await this.review.list(
      actor,
      filter ?? {},
      page ?? { page: 1, limit: 10 },
    );
    return { ...found, items: found.items.map(toRequestType) };
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => Int, { description: "Cadastros aguardando aprovação." })
  pendingEnrollmentCount(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<number> {
    return this.review.countPending(actor);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => EnrollmentRequestType)
  async enrollmentRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<EnrollmentRequestType> {
    return toRequestType(await this.review.get(actor, id));
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => EnrollmentApprovalType, {
    description:
      "Aprova o cadastro (com as correções) e dá acesso ao condomínio: cria a conta, ou vincula a conta que já existe com este e-mail.",
  })
  async approveEnrollmentRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("data") data: EnrollmentDataInput,
    @Args("group", { type: () => UserGroup }) group: UserGroup,
  ): Promise<EnrollmentApprovalType> {
    const approval = await this.review.approve(actor, id, data, group);
    return {
      request: toRequestType(approval.request),
      access: {
        ...approval.access,
        user: toAccountType(approval.access.user),
      },
    };
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => EnrollmentRequestType)
  async rejectEnrollmentRequest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<EnrollmentRequestType> {
    return toRequestType(
      await this.review.reject(actor, id, reason.slice(0, 600)),
    );
  }
}
