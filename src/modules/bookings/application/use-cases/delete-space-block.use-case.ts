import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  SPACE_BLOCK_REPOSITORY,
  type SpaceBlockRepositoryPort,
} from "@/modules/bookings/application/ports/space-block-repository.port";

// Removes a block: the period becomes bookable again. Bookings it cancelled
// stay cancelled.
@Injectable()
export class DeleteSpaceBlockUseCase {
  constructor(
    @Inject(SPACE_BLOCK_REPOSITORY)
    private readonly blocks: SpaceBlockRepositoryPort,
  ) {}

  async execute(actor: AuthenticatedUser, id: string): Promise<void> {
    if (!(await this.blocks.find(tenantOf(actor), id))) {
      throw AppException.from(APP_ERRORS.bookings.blockNotFound, undefined);
    }
    await this.blocks.delete(id);
  }
}
