import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { DependentAccessService } from "@/modules/dependents/application/dependent-access.service";
import {
  DEPENDENT_REPOSITORY,
  type DependentRepositoryPort,
} from "@/modules/dependents/application/ports/dependent-repository.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// A resident removes one of their dependents (and its document). Orders
// already made keep the person's name and age.
@Injectable()
export class RemoveDependentUseCase {
  constructor(
    @Inject(DEPENDENT_REPOSITORY)
    private readonly dependents: DependentRepositoryPort,
    private readonly access: DependentAccessService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async execute(actor: AuthenticatedUser, id: string): Promise<boolean> {
    const { condominiumId, membershipId } = this.access.membershipOf(actor);
    const dependent = await this.dependents.find(condominiumId, id);
    if (!dependent || dependent.membershipId !== membershipId) {
      throw AppException.from(APP_ERRORS.dependents.notFound, undefined);
    }
    await this.dependents.remove(id);
    await this.storage.deleteMany([dependent.documentKey]).catch(() => {});
    return true;
  }
}
