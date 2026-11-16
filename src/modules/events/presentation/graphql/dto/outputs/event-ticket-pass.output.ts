import { Field, ObjectType } from "@nestjs/graphql";
import { TicketPassStatus } from "@/modules/events/domain/event-ticket-entry";
import "@/modules/events/presentation/graphql/events.graphql-enums";

@ObjectType("EventTicketPass", {
  description: "Ingresso de uma pessoa (página pública).",
})
export class EventTicketPassType {
  @Field(() => String)
  code!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String, {
    nullable: true,
    description: "Tipo do ingresso (null: evento gratuito).",
  })
  ticketName!: string | null;

  @Field(() => String)
  eventTitle!: string;

  @Field(() => String, { description: "O espaço ou o local do evento." })
  placeName!: string;

  @Field(() => String)
  condominiumName!: string;

  @Field(() => Date)
  startsAt!: Date;

  @Field(() => Date)
  endsAt!: Date;

  @Field(() => String, {
    nullable: true,
    description: "Primeiro nome de quem pediu.",
  })
  buyerFirstName!: string | null;

  @Field(() => TicketPassStatus)
  status!: TicketPassStatus;

  @Field(() => Boolean, { description: "Já entrou pela portaria." })
  checkedIn!: boolean;
}
