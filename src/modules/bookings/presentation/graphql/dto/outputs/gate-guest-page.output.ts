import { Paginated } from "@/common/graphql/pagination.graphql";
import { GateGuestType } from "@/modules/bookings/presentation/graphql/dto/outputs/gate-guest.output";

export const GateGuestPage = Paginated(GateGuestType, "GateGuestPage");
