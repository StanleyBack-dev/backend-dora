import { Inject, Injectable } from "@nestjs/common";
import {
  DEPENDENT_REPOSITORY,
  type DependentRepositoryPort,
} from "@/modules/dependents/application/ports/dependent-repository.port";
import { DependentStatus } from "@/modules/dependents/domain/dependent";

/** An approved dependent, as other modules need it. */
export type ApprovedDependent = { id: string; name: string; birthDate: string };

// Read-only access for other modules: events price a dependent's ticket by
// the approved birth date.
@Injectable()
export class DependentLookupService {
  constructor(
    @Inject(DEPENDENT_REPOSITORY)
    private readonly dependents: DependentRepositoryPort,
  ) {}

  async approvedOf(membershipId: string): Promise<ApprovedDependent[]> {
    return (await this.dependents.listByMembership(membershipId))
      .filter((dependent) => dependent.status === DependentStatus.APPROVED)
      .map(({ id, name, birthDate }) => ({ id, name, birthDate }));
  }
}
