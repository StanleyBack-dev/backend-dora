import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import {
  PARCEL_REPOSITORY,
  type Parcel,
  type ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import { isOpen, normalizeParcelCode } from "@/modules/parcels/domain/parcel";

// The gate finds a parcel by its pickup code (the resident's QR, or typed).
// Another condominium's parcel is "not found" here.
@Injectable()
export class FindParcelByCodeUseCase {
  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
    private readonly access: ParcelAccessService,
  ) {}

  async execute(actor: AuthenticatedUser, code: string): Promise<Parcel> {
    const condominiumId = await this.access.condominiumOf(actor);
    const normalized = normalizeParcelCode(code);
    const parcel = normalized
      ? await this.parcels.findByCode(normalized)
      : null;
    if (!parcel || parcel.condominiumId !== condominiumId) {
      throw AppException.from(APP_ERRORS.parcels.codeNotFound, undefined);
    }
    return parcel;
  }

  /** Same, only while it is still at the gate. */
  async waiting(actor: AuthenticatedUser, code: string): Promise<Parcel> {
    const parcel = await this.execute(actor, code);
    if (!isOpen(parcel.status)) {
      throw AppException.from(APP_ERRORS.parcels.notWaiting, {
        reason: "Esta encomenda já foi entregue, devolvida ou cancelada.",
      });
    }
    return parcel;
  }
}
