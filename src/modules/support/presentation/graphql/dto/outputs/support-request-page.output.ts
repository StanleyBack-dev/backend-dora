import { Paginated } from "@/common/graphql/pagination.graphql";
import { SupportRequestType } from "@/modules/support/presentation/graphql/dto/outputs/support-request.output";

export const SupportRequestPage = Paginated(
  SupportRequestType,
  "SupportRequestPage",
);
