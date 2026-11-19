import type {
  Dependent,
  DependentData,
  DependentRelationship,
  DependentStatus,
} from "@/modules/dependents/domain/dependent";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

export type NewDependent = DependentData & {
  condominiumId: string;
  membershipId: string;
  documentKey: string;
  documentContentType: string;
  createdBy: string;
};

/** What narrows the managers' list (absent: any). */
export type DependentReviewFilter = {
  status?: DependentStatus;
  dependentId?: string;
  /** The resident who registered it (user id). */
  holderId?: string;
  unitId?: string;
  relationship?: DependentRelationship;
};

/** Something to pick in a filter of the dependents. */
export type DependentFilterOption = { id: string; label: string };

/** The dependents at a glance: counts by status and the filter options. */
export type DependentReviewOverview = {
  pending: number;
  approved: number;
  rejected: number;
  dependents: DependentFilterOption[];
  holders: DependentFilterOption[];
  units: DependentFilterOption[];
};

export interface DependentRepositoryPort {
  /** A resident's dependents (by name). */
  listByMembership(membershipId: string): Promise<Dependent[]>;
  /** The condominium's dependents (optionally one status), oldest first. */
  listForReview(
    condominiumId: string,
    status: DependentStatus | null,
  ): Promise<Dependent[]>;
  /** A page of the condominium's dependents, filtered, oldest first. */
  pageForReview(
    condominiumId: string,
    filter: DependentReviewFilter,
    page: PageRequest,
  ): Promise<Paginated<Dependent>>;
  /** Counts by status and what the filters offer, whatever the filters. */
  reviewOverview(condominiumId: string): Promise<DependentReviewOverview>;
  /** Only a dependent of this condominium. */
  find(condominiumId: string, id: string): Promise<Dependent | null>;
  countByMembership(membershipId: string): Promise<number>;
  /** Stores it (pending) with the managers' notices in one transaction. */
  create(dependent: NewDependent, notices: OutboxDraft[]): Promise<Dependent>;
  /** Approves or rejects a pending one (null: not pending any more). */
  review(
    id: string,
    decision: {
      status: DependentStatus.APPROVED | DependentStatus.REJECTED;
      reviewerId: string;
      reason: string | null;
      at: Date;
    },
    notices: OutboxDraft[],
  ): Promise<Dependent | null>;
  remove(id: string): Promise<void>;
}

export const DEPENDENT_REPOSITORY = Symbol("DEPENDENT_REPOSITORY");
