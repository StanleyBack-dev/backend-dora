import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { EventStatus } from "@/modules/events/domain/event";
import { EventPixSource } from "@/modules/events/domain/event-tickets";
import { EventAddressType } from "@/modules/events/presentation/graphql/dto/outputs/event-address.output";
import { EventPixType } from "@/modules/events/presentation/graphql/dto/outputs/event-pix.output";
import { TicketTypeType } from "@/modules/events/presentation/graphql/dto/outputs/ticket-type.output";
import "@/modules/events/presentation/graphql/events.graphql-enums";
import { EventSalesClose } from "@/modules/events/domain/event";

@ObjectType("Event", { description: "Evento do condomínio." })
export class EventType {
  @Field(() => ID)
  id!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => ID, { nullable: true })
  spaceId!: string | null;

  @Field(() => String, { nullable: true })
  spaceName!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Com espaço, um detalhe; fora do condomínio, o nome do local.",
  })
  location!: string | null;

  @Field(() => EventAddressType, {
    nullable: true,
    description: "Endereço do local fora do condomínio (nulo com espaço).",
  })
  address!: EventAddressType | null;

  @Field()
  startsAt!: Date;

  @Field()
  endsAt!: Date;

  @Field(() => Int, { description: "Lotação total." })
  capacity!: number;

  @Field(() => Int, { description: "Convidados de fora (0: só moradores)." })
  externalGuestLimit!: number;

  @Field({ description: "Entrada com ingresso pago (Pix)." })
  ticketed!: boolean;

  @Field(() => Int, {
    nullable: true,
    description: "Valor da inteira, em centavos (nulo sem ingresso).",
  })
  fullPriceCents!: number | null;

  @Field(() => [TicketTypeType], {
    description: "Tipos de ingresso, na ordem (vazio sem ingresso).",
  })
  ticketTypes!: TicketTypeType[];

  @Field(() => Int, {
    nullable: true,
    description: "Máximo de ingressos por unidade (nulo: sem limite).",
  })
  unitTicketLimit!: number | null;

  @Field(() => EventSalesClose)
  salesClose!: EventSalesClose;

  @Field(() => Int, {
    description: "Com BEFORE_START: quantas horas antes do início.",
  })
  salesCloseHours!: number;

  @Field(() => Date, { description: "Quando as vendas fecham." })
  salesClosesAt!: Date;

  @Field(() => EventPixSource, { nullable: true })
  pixSource!: EventPixSource | null;

  @Field(() => EventPixType, {
    nullable: true,
    description: "Com pixSource CUSTOM: o PIX do evento.",
  })
  customPix!: EventPixType | null;

  @Field(() => Int, { description: "Vagas ainda livres (lotação total)." })
  placesLeft!: number;

  @Field(() => Int, {
    description: "Vagas ainda livres para convidados de fora.",
  })
  outsidePlacesLeft!: number;

  @Field(() => EventStatus)
  status!: EventStatus;

  @Field(() => String, { nullable: true })
  cancelReason!: string | null;

  @Field(() => Date, { nullable: true })
  publishedAt!: Date | null;

  @Field(() => Date, { nullable: true })
  cancelledAt!: Date | null;

  @Field()
  createdAt!: Date;
}
