import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import type { PurchaseRequestData } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import type { SpaceLookupService } from "@/modules/spaces/application/space-lookup.service";

/**
 * Where it will be used: with a space, it must be one of the condominium's
 * spaces and active (the request's current one stays valid even if
 * deactivated since), and its name becomes the location (kept should the
 * space be deleted); without one, the location is the place typed.
 */
export async function withSpace(
  spaces: SpaceLookupService,
  condominiumId: string,
  data: PurchaseRequestData,
  currentSpaceId: string | null = null,
): Promise<PurchaseRequestData> {
  if (!data.spaceId) return data;
  const space = await spaces.find(condominiumId, data.spaceId);
  if (!space || (!space.active && space.id !== currentSpaceId)) {
    throw AppException.from(APP_ERRORS.purchases.spaceUnavailable, undefined);
  }
  return { ...data, location: space.name };
}
