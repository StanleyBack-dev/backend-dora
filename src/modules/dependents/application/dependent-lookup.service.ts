import { Inject, Injectable } from "@nestjs/common";
import {
  DEPENDENT_REPOSITORY,
  type DependentRepositoryPort,
} from "@/modules/dependents/application/ports/dependent-repository.port";
import {
  type DependentRelationship,
  DependentStatus,
} from "@/modules/dependents/domain/dependent";

/** An approved dependent, as other modules need it. */
export type ApprovedDependent = {
  id: string;
  name: string;
  birthDate: string;
  relationship: DependentRelationship;
};

// Read-only access for other modules: events price a dependent's ticket by
// the approved birth date; the residents' directory lists them.
@Injectable()
export class DependentLookupService {
  constructor(
    @Inject(DEPENDENT_REPOSITORY)
    private readonly dependents: DependentRepositoryPort,
  ) {}

  async approvedOf(membershipId: string): Promise<ApprovedDependent[]> {
    return (await this.dependents.listByMembership(membershipId))
      .filter((dependent) => dependent.status === DependentStatus.APPROVED)
      .map(({ id, name, birthDate, relationship }) => ({
        id,
        name,
        birthDate,
        relationship,
      }));
  }

  /** The approved dependents of each of these residents (membership id). */
  async approvedOfMany(
    membershipIds: readonly string[],
  ): Promise<Map<string, ApprovedDependent[]>> {
    const lists = await Promise.all(
      membershipIds.map((id) => this.approvedOf(id)),
    );
    return new Map(membershipIds.map((id, index) => [id, lists[index]]));
  }
}
