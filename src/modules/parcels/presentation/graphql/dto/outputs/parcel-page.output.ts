import { Paginated } from "@/common/graphql/pagination.graphql";
import { ParcelType } from "@/modules/parcels/presentation/graphql/dto/outputs/parcel.output";

export const ParcelPage = Paginated(ParcelType, "ParcelPage");
