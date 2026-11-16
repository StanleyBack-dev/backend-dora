import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { ReviewDependentsUseCase } from "@/modules/dependents/application/use-cases/review-dependents.use-case";
import {
  DependentStatus,
  type Dependent,
} from "@/modules/dependents/domain/dependent";
import { DependentType } from "@/modules/dependents/presentation/graphql/dto/outputs/dependent.output";
import "@/modules/dependents/presentation/graphql/dependents.graphql-enums";

// The managers review the condominium's dependents.
@Resolver()
export class DependentsReviewResolver {
  constructor(private readonly review: ReviewDependentsUseCase) {}

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => [DependentType], {
    description: "Dependentes do condomínio (opcionalmente de uma situação).",
  })
  dependents(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("status", { type: () => DependentStatus, nullable: true })
    status?: DependentStatus | null,
  ): Promise<Dependent[]> {
    return this.review.list(actor, status ?? null);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => DependentType, {
    description: "Aprova o dependente (o documento confere).",
  })
  approveDependent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<Dependent> {
    return this.review.approve(actor, id);
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Mutation(() => DependentType, {
    description: "Recusa o dependente, com o motivo.",
  })
  rejectDependent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<Dependent> {
    return this.review.reject(actor, id, reason);
  }
}
