import { registerEnumType } from "@nestjs/graphql";
import { DocumentType } from "@/shared/domain/identity-document";
import { SlotState } from "@/modules/bookings/application/use-cases/get-space-availability.use-case";
import { BookingStatus, BookingWhen } from "@/modules/bookings/domain/booking";
import { GuestInviteStatus } from "@/modules/bookings/domain/booking-guest";
import { GuestCheckInWindow } from "@/modules/bookings/presentation/graphql/guest-check-in-window";

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
registerEnumType(GuestInviteStatus, {
  name: "GuestInviteStatus",
  description: "Situação do convite: válido, cancelado ou encerrado.",
});
registerEnumType(GuestCheckInWindow, {
  name: "GuestCheckInWindow",
  description: "Se a portaria já pode liberar a entrada do convidado.",
});
registerEnumType(DocumentType, {
  name: "DocumentType",
  description: "Documento de identidade: CPF ou RG.",
});
