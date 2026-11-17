import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { EventStatus } from "@/modules/events/domain/event";
import { AttendeeSource } from "@/modules/events/domain/event-order";
import { TicketEntryWindow } from "@/modules/events/presentation/graphql/ticket-entry-window";
import "@/modules/events/presentation/graphql/events.graphql-enums";

@ObjectType("GateEventTicket", {
  description: "Ingresso de evento na lista da portaria.",
})
export class GateEventTicketType {
  @Field(() => ID, { description: "A pessoa do pedido." })
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Int, { description: "Idade no dia do evento." })
  age!: number;

  @Field({ description: "Convidado de fora do condomínio." })
  outside!: boolean;

  @Field(() => AttendeeSource)
  source!: AttendeeSource;

  @Field(() => String, {
    nullable: true,
    description: "Tipo do ingresso (null: evento gratuito).",
  })
  ticketName!: string | null;

  @Field(() => String, { description: "Código do ingresso (QR)." })
  ticketCode!: string;

  @Field(() => Date, { nullable: true })
  checkedInAt!: Date | null;

  @Field(() => TicketEntryWindow)
  entryWindow!: TicketEntryWindow;

  @Field(() => ID)
  eventId!: string;

  @Field(() => String)
  eventTitle!: string;

  @Field(() => EventStatus)
  eventStatus!: EventStatus;

  @Field(() => Date)
  startsAt!: Date;

  @Field(() => Date)
  endsAt!: Date;

  @Field(() => String, { description: "O espaço ou o local do evento." })
  placeName!: string;

  @Field(() => String, { description: "Código do pedido." })
  orderCode!: string;

  @Field(() => String, { nullable: true, description: "Quem pediu." })
  buyerName!: string | null;

  @Field(() => ID, { nullable: true, description: "A unidade de quem pediu." })
  unitId!: string | null;

  @Field(() => String, { nullable: true })
  unitLabel!: string | null;
}
