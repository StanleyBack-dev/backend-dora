import { Inject, Injectable } from "@nestjs/common";
import {
  SPACE_REPOSITORY,
  type SpaceRepositoryPort,
} from "@/modules/spaces/application/ports/space-repository.port";
import type { Space } from "@/modules/spaces/domain/space";

// What other modules (bookings) may read about spaces.
@Injectable()
export class SpaceLookupService {
  constructor(
    @Inject(SPACE_REPOSITORY) private readonly spaces: SpaceRepositoryPort,
  ) {}

  /** The space, only when it belongs to the condominium. */
  find(condominiumId: string, id: string): Promise<Space | null> {
    return this.spaces.find(condominiumId, id);
  }
}
