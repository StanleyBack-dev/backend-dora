import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { closedNotices } from "@/modules/parcels/application/parcel-notices";
import {
  PARCEL_REPOSITORY,
  type Parcel,
  type ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import {
  normalizeCloseReason,
  ParcelStatus,
} from "@/modules/parcels/domain/parcel";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// A parcel still at the gate is returned to the sender, or cancelled when
// it was registered by mistake, always with the reason. The unit's
// residents are told.
@Injectable()
export class CloseParcelUseCase {
  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
    private readonly access: ParcelAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    status: ParcelStatus.RETURNED | ParcelStatus.CANCELLED,
    reason: string,
  ): Promise<Parcel> {
    const condominiumId = await this.access.condominiumOf(actor);
    const parcel = await this.parcels.find(condominiumId, id);
    if (!parcel) {
      throw AppException.from(APP_ERRORS.parcels.notFound, undefined);
    }
    const why = normalizeCloseReason(reason);
    if (!why) {
      throw AppException.from(APP_ERRORS.parcels.invalidReason, undefined);
    }
    const residents = await this.access.audience(parcel);
    const closed = await this.parcels.close(
      parcel.id,
      { status, reason: why, by: actor.id, at: this.clock.now() },
      (updated) => closedNotices(updated, residents, this.clock.timeZone),
    );
    if (!closed) {
      throw AppException.from(APP_ERRORS.parcels.notWaiting, {
        reason: "Esta encomenda já foi entregue, devolvida ou cancelada.",
      });
    }
    return closed;
  }
}
