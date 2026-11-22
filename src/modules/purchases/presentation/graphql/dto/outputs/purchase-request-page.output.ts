import { Paginated } from "@/common/graphql/pagination.graphql";
import { PurchaseRequestType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request.output";

export const PurchaseRequestPage = Paginated(
  PurchaseRequestType,
  "PurchaseRequestPage",
);
