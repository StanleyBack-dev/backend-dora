import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  SPACE_REPOSITORY,
  type SpaceData,
  type SpaceRepositoryPort,
} from "@/modules/spaces/application/ports/space-repository.port";
import { validateSpaceInput } from "@/modules/spaces/application/space-input";
import type { Space } from "@/modules/spaces/domain/space";

// Saves the whole form (details and rules). Bookings already made keep the
// rules they were made under; the new ones apply from now on.
@Injectable()
export class UpdateSpaceUseCase {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    input: SpaceData,
  ): Promise<Space> {
    const condominiumId = tenantOf(actor);
    if (!(await this.spaces.find(condominiumId, id))) {
      throw AppException.from(APP_ERRORS.spaces.notFound, undefined);
    }
    const data = validateSpaceInput(input);
    const sameName = await this.spaces.findByName(condominiumId, data.name);
    if (sameName && sameName.id !== id) {
      throw AppException.from(APP_ERRORS.spaces.nameTaken, undefined);
    }
    const updated = await this.spaces.update(id, data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "space",
      entityId: id,
    });
    return updated;
  }
}
