import { Paginated } from "@/common/graphql/pagination.graphql";
import { LostReportType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/lost-report.output";

export const LostReportPage = Paginated(LostReportType, "LostReportPage");
