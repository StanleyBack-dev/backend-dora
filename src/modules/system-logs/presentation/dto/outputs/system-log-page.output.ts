import { Paginated } from "@/common/graphql/pagination.graphql";
import { SystemLogType } from "@/modules/system-logs/presentation/dto/outputs/system-log.output";

export const SystemLogPage = Paginated(SystemLogType, "SystemLogPage");
