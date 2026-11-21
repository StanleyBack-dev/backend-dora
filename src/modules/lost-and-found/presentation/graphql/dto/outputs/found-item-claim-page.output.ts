import { Paginated } from "@/common/graphql/pagination.graphql";
import { FoundItemClaimType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-claim.output";

export const FoundItemClaimPage = Paginated(
  FoundItemClaimType,
  "FoundItemClaimPage",
);
