import { Paginated } from "@/common/graphql/pagination.graphql";
import { BookingType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking.output";

export const BookingPage = Paginated(BookingType, "BookingPage");
