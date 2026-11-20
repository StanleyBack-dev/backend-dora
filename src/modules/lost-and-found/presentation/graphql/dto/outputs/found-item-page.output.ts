import { Paginated } from "@/common/graphql/pagination.graphql";
import { FoundItemType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item.output";

export const FoundItemPage = Paginated(FoundItemType, "FoundItemPage");
