import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import { authorizedNotices } from "@/modules/parcels/application/parcel-notices";
import {
  PARCEL_REPOSITORY,
  type Parcel,
  type ParcelAuthorization,
  type ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import { normalizePerson } from "@/modules/parcels/domain/parcel-person";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { DocumentType } from "@/shared/domain/identity-document";

export type AuthorizePickupInput = {
  name: string;
  documentType?: DocumentType | null;
  document?: string | null;
};

const NOT_WAITING = "Esta encomenda já foi entregue, devolvida ou cancelada.";

// Someone else picks up: whoever sees a waiting parcel (a resident of the
// unit, the one it was registered for, or the desk on their behalf) names
// one person, with an optional CPF or RG. A new one replaces the previous;
// it can be removed while the parcel waits. The desk sees it when the code
// is read, and the pickup's evidence keeps it.
@Injectable()
export class AuthorizeParcelPickupUseCase {
  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
    private readonly access: ParcelAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async authorize(
    actor: AuthenticatedUser,
    parcelId: string,
    input: AuthorizePickupInput,
  ): Promise<Parcel> {
    const parcel = await this.waiting(actor, parcelId);
    const checked = normalizePerson(input, "da pessoa autorizada");
    if ("error" in checked) {
      throw AppException.from(APP_ERRORS.parcels.invalidSigner, {
        reason: checked.error,
      });
    }
    return this.save(parcel, actor, {
      ...checked.person,
      by: actor.id,
      at: this.clock.now(),
    });
  }

  async revoke(actor: AuthenticatedUser, parcelId: string): Promise<Parcel> {
    const parcel = await this.waiting(actor, parcelId);
    // Nothing to remove: no change, nobody told.
    if (!parcel.authorizedName) return parcel;
    return this.save(parcel, actor, null);
  }

  private async waiting(actor: AuthenticatedUser, parcelId: string) {
    const parcel = await this.access.loadVisible(actor, parcelId);
    if (parcel.status !== ParcelStatus.RECEIVED) {
      throw AppException.from(APP_ERRORS.parcels.notWaiting, {
        reason: NOT_WAITING,
      });
    }
    return parcel;
  }

  private async save(
    parcel: Parcel,
    actor: AuthenticatedUser,
    authorization: ParcelAuthorization | null,
  ): Promise<Parcel> {
    // The others who see it are told; not who made the change.
    const audience = (await this.access.audience(parcel)).filter(
      (userId) => userId !== actor.id,
    );
    const saved = await this.parcels.authorize(
      parcel.id,
      authorization,
      actor.id,
      (updated) => authorizedNotices(updated, audience, this.clock.timeZone),
    );
    if (!saved) {
      // Picked up, returned or cancelled meanwhile.
      throw AppException.from(APP_ERRORS.parcels.notWaiting, {
        reason: NOT_WAITING,
      });
    }
    return saved;
  }
}
