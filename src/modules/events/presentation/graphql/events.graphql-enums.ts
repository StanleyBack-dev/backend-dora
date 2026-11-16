import { registerEnumType } from "@nestjs/graphql";
import { EventStatus } from "@/modules/events/domain/event";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import {
  EventPixSource,
  TicketKind,
  TicketPriceMode,
} from "@/modules/events/domain/event-tickets";
import { AttendeeSource } from "@/modules/events/domain/event-order";

registerEnumType(EventStatus, {
  name: "EventStatus",
  description: "Rascunho (só gestores), publicado ou cancelado.",
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
