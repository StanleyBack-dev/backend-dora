import { registerEnumType } from "@nestjs/graphql";
import { EventSalesClose, EventStatus } from "@/modules/events/domain/event";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import {
  EventPixSource,
  TicketKind,
  TicketPriceMode,
} from "@/modules/events/domain/event-tickets";
import { AttendeeSource } from "@/modules/events/domain/event-order";
import { TicketPassStatus } from "@/modules/events/domain/event-ticket-entry";
import { TicketEntryWindow } from "@/modules/events/presentation/graphql/ticket-entry-window";

registerEnumType(EventStatus, {
  name: "EventStatus",
  description: "Rascunho (só gestores), publicado ou cancelado.",
});

registerEnumType(EventSalesClose, {
  name: "EventSalesClose",
  description:
    "Quando as vendas fecham: algumas horas antes do início, ou só no fim do evento.",
});

registerEnumType(EventPixSource, {
  name: "EventPixSource",
  description: "Quem recebe os ingressos: o PIX do condomínio ou outro.",
});

registerEnumType(TicketKind, {
  name: "TicketKind",
  description:
    "Público do ingresso: adulto, criança, infantil, idoso, estudante, PcD ou professor.",
});

registerEnumType(TicketPriceMode, {
  name: "TicketPriceMode",
  description: "Quanto o público paga: inteira, meia, grátis ou outro valor.",
});

registerEnumType(AttendeeSource, {
  name: "AttendeeSource",
  description: "Quem é a pessoa do pedido: eu, um dependente ou outra pessoa.",
});

registerEnumType(EventOrderStatus, {
  name: "EventOrderStatus",
  description:
    "Aguardando pagamento, em conferência, confirmado, recusado, expirado ou cancelado.",
});

/** Which events to list. */
export enum EventWhen {
  UPCOMING = "UPCOMING",
  PAST = "PAST",
}

registerEnumType(EventWhen, {
  name: "EventWhen",
  description: "Próximos (ainda não terminaram) ou passados.",
});

registerEnumType(TicketEntryWindow, {
  name: "TicketEntryWindow",
  description:
    "Se a portaria pode liberar o ingresso agora: aberta, cedo demais, encerrado ou cancelado.",
});

registerEnumType(TicketPassStatus, {
  name: "TicketPassStatus",
  description: "Ingresso válido, de evento cancelado ou já encerrado.",
});
