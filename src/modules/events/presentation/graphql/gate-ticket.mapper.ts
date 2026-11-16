import type { GateTicket } from "@/modules/events/application/use-cases/list-gate-event-tickets.use-case";
import type { GateEventTicketType } from "@/modules/events/presentation/graphql/dto/outputs/gate-event-ticket.output";
import { entryWindowOf } from "@/modules/events/presentation/graphql/ticket-entry-window";

/** A ticket on the gate list as the API shows it. */
export const toGateTicketType = (ticket: GateTicket): GateEventTicketType => ({
  id: ticket.id,
  name: ticket.name,
  age: ticket.age,
  outside: ticket.outside,
  source: ticket.source,
  ticketName: ticket.ticketName,
  ticketCode: ticket.ticketCode,
  checkedInAt: ticket.checkedInAt,
  entryWindow: entryWindowOf(ticket.entryDenial),
  eventId: ticket.eventId,
  eventTitle: ticket.eventTitle,
  eventStatus: ticket.eventStatus,
  startsAt: ticket.startsAt,
  endsAt: ticket.endsAt,
  placeName: ticket.placeName,
  orderCode: ticket.orderCode,
  buyerName: ticket.buyerName,
  unitLabel: ticket.unitLabel,
});
