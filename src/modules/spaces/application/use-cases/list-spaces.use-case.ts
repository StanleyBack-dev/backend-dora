import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import {
  SPACE_REPOSITORY,
  type SpaceRepositoryPort,
} from "@/modules/spaces/application/ports/space-repository.port";
import type { Space } from "@/modules/spaces/domain/space";

// Every member sees the active spaces of their condominium; whoever manages
// spaces also sees the inactive ones (under maintenance).
@Injectable()
export class ListSpacesUseCase {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
    private readonly permissions: PermissionsService,
  ) {}

  async list(
    actor: AuthenticatedUser,
    includeInactive: boolean,
  ): Promise<Space[]> {
    const condominiumId = tenantOf(actor);
    const seeInactive = includeInactive && (await this.canManage(actor));
    return this.spaces.list(condominiumId, seeInactive);
  }

  async get(actor: AuthenticatedUser, id: string): Promise<Space> {
    const space = await this.spaces.find(tenantOf(actor), id);
    if (!space || (!space.active && !(await this.canManage(actor)))) {
      throw AppException.from(APP_ERRORS.spaces.notFound, undefined);
    }
    return space;
  }

  private async canManage(actor: AuthenticatedUser): Promise<boolean> {
    return (await this.permissions.effectiveFor(actor)).has(
      Permission.SPACES_MANAGE,
    );
  }
}
