import { Paginated } from "@/common/graphql/pagination.graphql";
import { GateEventTicketType } from "@/modules/events/presentation/graphql/dto/outputs/gate-event-ticket.output";

export const GateEventTicketPage = Paginated(
  GateEventTicketType,
  "GateEventTicketPage",
);
