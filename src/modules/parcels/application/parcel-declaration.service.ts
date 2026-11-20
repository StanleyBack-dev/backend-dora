import { Injectable } from "@nestjs/common";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import type { Parcel } from "@/modules/parcels/application/ports/parcel-repository.port";
import { pickupDeclaration } from "@/modules/parcels/domain/parcel-signature";

// The declaration shown at the gate before signing, and checked again when
// the signature arrives (the signer's name goes in front of it).
@Injectable()
export class ParcelDeclarationService {
  constructor(private readonly condominiums: CondominiumLookupService) {}

  async forParcel(
    parcel: Pick<
      Parcel,
      | "condominiumId"
      | "pickupCode"
      | "unitLabel"
      | "recipientName"
      | "carrier"
      | "trackingCode"
    >,
  ): Promise<string> {
    const condominium = await this.condominiums.find(parcel.condominiumId);
    return pickupDeclaration({
      code: parcel.pickupCode,
      condominiumName: condominium?.name ?? "condomínio",
      unitLabel: parcel.unitLabel,
      recipientName: parcel.recipientName,
      carrier: parcel.carrier,
      trackingCode: parcel.trackingCode,
    });
  }
}
