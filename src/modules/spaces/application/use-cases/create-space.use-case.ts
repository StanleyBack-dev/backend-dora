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

@Injectable()
export class CreateSpaceUseCase {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
    private readonly audit: AuditTrailService,
  ) {}

  async execute(actor: AuthenticatedUser, input: SpaceData): Promise<Space> {
    const condominiumId = tenantOf(actor);
    const data = validateSpaceInput(input);
    if (await this.spaces.findByName(condominiumId, data.name)) {
      throw AppException.from(APP_ERRORS.spaces.nameTaken, undefined);
    }
    const created = await this.spaces.create(condominiumId, data);
    await this.audit.stamp({
      actorId: actor.id,
      entity: "space",
      entityId: created.id,
      created: true,
    });
    return created;
  }
}
