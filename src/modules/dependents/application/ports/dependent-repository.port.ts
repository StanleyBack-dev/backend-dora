import type {
  Dependent,
  DependentData,
  DependentStatus,
} from "@/modules/dependents/domain/dependent";
import type { OutboxDraft } from "@/modules/outbox/domain/outbox";

export type NewDependent = DependentData & {
  condominiumId: string;
  membershipId: string;
  documentKey: string;
  documentContentType: string;
  createdBy: string;
};

export interface DependentRepositoryPort {
  /** A resident's dependents (by name). */
  listByMembership(membershipId: string): Promise<Dependent[]>;
  /** The condominium's dependents (optionally one status), oldest first. */
  listForReview(
    condominiumId: string,
    status: DependentStatus | null,
  ): Promise<Dependent[]>;
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
