import { Inject, Injectable } from "@nestjs/common";
import {
  PARCEL_REPOSITORY,
  type ParcelRepositoryPort,
  type ParcelSignature,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import {
  canonicalJson,
  sha256,
} from "@/modules/parcels/domain/parcel-signature";

export type CheckedSignature = ParcelSignature & {
  /**
   * The record is intact: the evidence stored still gives the digest
   * written at signing, and the drawing still gives its own digest.
   */
  intact: boolean;
};

// The pickup receipt: the signature with its evidence, and whether the
// record is intact. The caller already checked who may see the parcel.
@Injectable()
export class GetParcelSignatureUseCase {
  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
  ) {}

  async execute(parcelId: string): Promise<CheckedSignature | null> {
    const signature = await this.parcels.findSignature(parcelId);
    if (!signature) return null;
    const evidence = signature.evidence as Record<string, unknown> | null;
    const intact =
      sha256(canonicalJson(signature.evidence)) === signature.evidenceSha256 &&
      sha256(canonicalJson(signature.drawing)) === signature.strokesSha256 &&
      evidence?.strokesSha256 === signature.strokesSha256 &&
      evidence?.imageSha256 === signature.imageSha256;
    return { ...signature, intact };
  }
}
