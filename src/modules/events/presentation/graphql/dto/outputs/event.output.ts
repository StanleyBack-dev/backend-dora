import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { EventStatus } from "@/modules/events/domain/event";
import { EventAddressType } from "@/modules/events/presentation/graphql/dto/outputs/event-address.output";
import "@/modules/events/presentation/graphql/events.graphql-enums";

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
