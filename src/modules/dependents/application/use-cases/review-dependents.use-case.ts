import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { tenantOf } from "@/common/auth/tenant";
import { decidedNotice } from "@/modules/dependents/application/dependent-notices";
import {
  DEPENDENT_REPOSITORY,
  type DependentRepositoryPort,
  type DependentReviewFilter,
  type DependentReviewOverview,
} from "@/modules/dependents/application/ports/dependent-repository.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import {
  DependentStatus,
  normalizeDependentRejectReason,
  type Dependent,
} from "@/modules/dependents/domain/dependent";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// The managers list the condominium's dependents and approve each pending
// one (the document matches the name and the birth date) or reject it with
// a reason. The resident is told either way.
@Injectable()
export class ReviewDependentsUseCase {
  constructor(
    @Inject(DEPENDENT_REPOSITORY)
    private readonly dependents: DependentRepositoryPort,
    private readonly users: UserLookupService,
    private readonly outbox: OutboxDispatcher,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  list(
    actor: AuthenticatedUser,
    status: DependentStatus | null,
  ): Promise<Dependent[]> {
    return this.dependents.listForReview(tenantOf(actor), status);
  }

  /** A page of the condominium's dependents, filtered by the API. */
  page(
    actor: AuthenticatedUser,
    filter: DependentReviewFilter,
    page: PageRequest,
  ): Promise<Paginated<Dependent>> {
    return this.dependents.pageForReview(tenantOf(actor), filter, page);
  }

  /** Counts by status and the filters' options, whatever the filters. */
  overview(actor: AuthenticatedUser): Promise<DependentReviewOverview> {
    return this.dependents.reviewOverview(tenantOf(actor));
  }

  approve(actor: AuthenticatedUser, id: string): Promise<Dependent> {
    return this.decide(actor, id, DependentStatus.APPROVED, null);
  }

  reject(
    actor: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<Dependent> {
    const clean = normalizeDependentRejectReason(reason);
    if (!clean) {
      throw AppException.from(APP_ERRORS.dependents.invalidReason, undefined);
    }
    return this.decide(actor, id, DependentStatus.REJECTED, clean);
  }

  private async decide(
    actor: AuthenticatedUser,
    id: string,
    status: DependentStatus.APPROVED | DependentStatus.REJECTED,
    reason: string | null,
  ): Promise<Dependent> {
    const dependent = await this.dependents.find(tenantOf(actor), id);
    if (!dependent) {
      throw AppException.from(APP_ERRORS.dependents.notFound, undefined);
    }
    if (dependent.status !== DependentStatus.PENDING) {
      throw AppException.from(APP_ERRORS.dependents.notPending, undefined);
    }
    const holder = await this.users.memberUserId(dependent.membershipId);
    const decided = { ...dependent, status, rejectReason: reason };
    const reviewed = await this.dependents.review(
      id,
      { status, reviewerId: actor.id, reason, at: this.clock.now() },
      holder ? decidedNotice(decided, holder) : [],
    );
    if (!reviewed) {
      throw AppException.from(APP_ERRORS.dependents.notPending, undefined);
    }
    this.outbox.kick();
    return reviewed;
  }
}
