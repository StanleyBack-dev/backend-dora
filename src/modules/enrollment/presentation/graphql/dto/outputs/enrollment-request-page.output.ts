import { Paginated } from "@/common/graphql/pagination.graphql";
import { EnrollmentRequestType } from "@/modules/enrollment/presentation/graphql/dto/outputs/enrollment-request.output";

export const EnrollmentRequestPage = Paginated(
  EnrollmentRequestType,
  "EnrollmentRequestPage",
);
