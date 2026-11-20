import { registerEnumType } from "@nestjs/graphql";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";
import { LocationStatus } from "@/modules/parcels/domain/parcel-signature";

registerEnumType(ParcelStatus, {
  name: "ParcelStatus",
  description:
    "Na portaria, retirada, devolvida ao remetente ou cancelada (registrada por engano).",
});

registerEnumType(LocationStatus, {
  name: "SignatureLocationStatus",
  description:
    "Localização do aparelho na assinatura: obtida, recusada ou indisponível.",
});
