import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  SPACE_REPOSITORY,
  type SpaceRepositoryPort,
} from "@/modules/spaces/application/ports/space-repository.port";
import type { Space } from "@/modules/spaces/domain/space";

// Inactive (e.g. under maintenance): hidden from residents and not bookable.
@Injectable()
export class SetSpaceActiveUseCase {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    active: boolean,
  ): Promise<Space> {
    const space = await this.spaces.find(tenantOf(actor), id);
    if (!space) {
      throw AppException.from(APP_ERRORS.spaces.notFound, undefined);
    }
    if (space.active === active) return space;
    const updated = await this.spaces.update(id, { active });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "space",
      entityId: id,
    });
    return updated;
  }
}
