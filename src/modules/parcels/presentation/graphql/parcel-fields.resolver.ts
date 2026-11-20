import { Inject } from "@nestjs/common";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { ParcelDeclarationService } from "@/modules/parcels/application/parcel-declaration.service";
import { GetParcelSignatureUseCase } from "@/modules/parcels/application/use-cases/get-parcel-signature.use-case";
import { isOpen } from "@/modules/parcels/domain/parcel";
import { ParcelSignatureType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel-signature.output";
import { ParcelType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel.output";
import { toSignatureType } from "@/modules/parcels/presentation/graphql/parcel.mapper";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// The photo and the signature image as short-lived links, the pickup
// receipt and the declaration to sign. Every query that returns a parcel
// already checked the caller (the gate and managers, or the unit's
// residents).
@Resolver(() => ParcelType)
export class ParcelFieldsResolver {
  constructor(
    private readonly signatures: GetParcelSignatureUseCase,
    private readonly declarations: ParcelDeclarationService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Link temporário da foto da encomenda.",
  })
  async photoUrl(@Parent() parcel: ParcelType): Promise<string | null> {
    return parcel.photoKey ? this.storage.signedReadUrl(parcel.photoKey) : null;
  }

  @ResolveField(() => ParcelSignatureType, {
    nullable: true,
    description: "Comprovante da retirada (só encomendas retiradas).",
  })
  async signature(
    @Parent() parcel: ParcelType,
  ): Promise<ParcelSignatureType | null> {
    if (parcel.status !== "PICKED_UP") return null;
    const signature = await this.signatures.execute(parcel.id);
    if (!signature) return null;
    const imageUrl = await this.storage.signedReadUrl(signature.imageKey);
    return toSignatureType(signature, imageUrl);
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      'A declaração que quem retira assina, sem o começo "Eu, <nome>, ". Só enquanto está na portaria.',
  })
  async pickupDeclaration(
    @Parent() parcel: ParcelType,
  ): Promise<string | null> {
    if (!isOpen(parcel.status)) return null;
    return this.declarations.forParcel(parcel);
  }
}
