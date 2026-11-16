import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { DependentAccessService } from "@/modules/dependents/application/dependent-access.service";
import {
  DEPENDENT_REPOSITORY,
  type DependentRepositoryPort,
} from "@/modules/dependents/application/ports/dependent-repository.port";
import type { Dependent } from "@/modules/dependents/domain/dependent";

// The caller's own dependents (any status).
@Injectable()
export class ListMyDependentsUseCase {
  constructor(
    @Inject(DEPENDENT_REPOSITORY)
    private readonly dependents: DependentRepositoryPort,
    private readonly access: DependentAccessService,
  ) {}

  execute(actor: AuthenticatedUser): Promise<Dependent[]> {
    return this.dependents.listByMembership(
      this.access.membershipOf(actor).membershipId,
    );
  }
}
