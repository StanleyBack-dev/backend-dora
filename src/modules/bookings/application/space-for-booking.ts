import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { SpaceLookupService } from "@/modules/spaces/application/space-lookup.service";
import type { Space } from "@/modules/spaces/domain/space";

// The space a booking operation is about, from the session's condominium.
@Injectable()
export class SpaceForBooking {
  constructor(private readonly spaces: SpaceLookupService) {}

  /** The space; inactive ones only for whoever manages (`allowInactive`). */
  async load(
    actor: AuthenticatedUser,
    spaceId: string,
    allowInactive = false,
  ): Promise<Space> {
    const space = await this.spaces.find(tenantOf(actor), spaceId);
    if (!space) {
      throw AppException.from(APP_ERRORS.spaces.notFound, undefined);
    }
    if (!space.active && !allowInactive) {
      throw AppException.from(APP_ERRORS.bookings.spaceUnavailable, undefined);
    }
    return space;
  }
}
