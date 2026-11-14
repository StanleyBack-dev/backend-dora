import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SPACE_REPOSITORY,
  type SpaceRepositoryPort,
} from "@/modules/spaces/application/ports/space-repository.port";

// Removes a space created by mistake. Once bookings exist (next stage), a
// space with bookings is deactivated instead, to keep its history.
@Injectable()
export class DeleteSpaceUseCase {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
  ) {}

  async execute(actor: AuthenticatedUser, id: string): Promise<void> {
    if (!(await this.spaces.find(tenantOf(actor), id))) {
      throw AppException.from(APP_ERRORS.spaces.notFound, undefined);
    }
    await this.spaces.delete(id);
  }
}
