import { Paginated } from "@/common/graphql/pagination.graphql";
import { NotificationGqlType } from "@/modules/notifications/presentation/graphql/dto/outputs/notification.output";

export const NotificationPage = Paginated(
  NotificationGqlType,
  "NotificationPage",
);
