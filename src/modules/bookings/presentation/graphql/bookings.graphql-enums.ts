import { registerEnumType } from "@nestjs/graphql";
import { SlotState } from "@/modules/bookings/application/use-cases/get-space-availability.use-case";
import { BookingStatus, BookingWhen } from "@/modules/bookings/domain/booking";

registerEnumType(BookingStatus, {
  name: "BookingStatus",
  description: "Situação da reserva.",
});
registerEnumType(BookingWhen, {
  name: "BookingWhen",
  description: "Próximas (ainda não terminaram) ou passadas.",
});
registerEnumType(SlotState, {
  name: "SlotState",
  description: "Situação de um horário na grade do dia.",
});
