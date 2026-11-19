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
import { PageInput } from "@/common/graphql/pagination.graphql";
import type { DependentReviewOverview } from "@/modules/dependents/application/ports/dependent-repository.port";
import { DependentReviewFilterInput } from "@/modules/dependents/presentation/graphql/dto/inputs/dependent-review-filter.input";
import { DependentType } from "@/modules/dependents/presentation/graphql/dto/outputs/dependent.output";
import {
  DependentPage,
  DependentReviewOverviewType,
} from "@/modules/dependents/presentation/graphql/dto/outputs/dependent-review-overview.output";
import type { Paginated } from "@/shared/application/pagination";
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
  @Query(() => DependentPage, {
    description: "Página de dependentes do condomínio, filtrada.",
  })
  dependentsPage(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: DependentReviewFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<Dependent>> {
    return this.review.page(
      actor,
      filter ?? {},
      page ?? { page: 1, limit: 20 },
    );
  }

  @RequirePermissions(Permission.USERS_MANAGE)
  @Query(() => DependentReviewOverviewType, {
    description:
      "Os dependentes em números e as opções dos filtros (qualquer filtro).",
  })
  dependentsReviewOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DependentReviewOverview> {
    return this.review.overview(actor);
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
