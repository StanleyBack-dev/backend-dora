import { registerEnumType } from "@nestjs/graphql";
import "@/common/graphql/signature.graphql-enums";
import { ParcelStatus } from "@/modules/parcels/domain/parcel";

registerEnumType(ParcelStatus, {
  name: "ParcelStatus",
  description:
    "Na portaria, retirada, devolvida ao remetente ou cancelada (registrada por engano).",
});
