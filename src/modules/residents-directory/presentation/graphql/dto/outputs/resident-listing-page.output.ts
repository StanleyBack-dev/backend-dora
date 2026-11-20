import { Paginated } from "@/common/graphql/pagination.graphql";
import { ResidentListingType } from "@/modules/residents-directory/presentation/graphql/dto/outputs/resident-listing.output";

export const ResidentListingPage = Paginated(
  ResidentListingType,
  "ResidentListingPage",
);
