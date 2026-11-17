import { Paginated } from "@/common/graphql/pagination.graphql";
import { EventOrderType } from "@/modules/events/presentation/graphql/dto/outputs/event-order.output";

export const EventOrderPage = Paginated(EventOrderType, "EventOrderPage");
