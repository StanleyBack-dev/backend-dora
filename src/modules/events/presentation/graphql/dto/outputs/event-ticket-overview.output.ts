import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { UnitOptionType } from "@/modules/events/presentation/graphql/dto/outputs/unit-option.output";

@ObjectType("TicketTypeCount")
export class TicketTypeCountType {
  @Field(() => String, {
    nullable: true,
    description: "O tipo de ingresso (vazio: evento grátis).",
  })
  name!: string | null;

  @Field(() => Int)
  count!: number;
}

@ObjectType("TicketPersonOption", {
  description: "Uma pessoa com ingresso, para escolher num filtro.",
})
export class TicketPersonOptionType {
  @Field(() => ID, { description: "O id do ingresso." })
  id!: string;

  @Field()
  name!: string;

  @Field()
  ticketCode!: string;
}

@ObjectType("EventTicketOverview", {
  description:
    "Os números dos ingressos de um evento (sem filtros) e as opções dos filtros.",
})
export class EventTicketOverviewType {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  checkedIn!: number;

  @Field(() => Int)
  outside!: number;

  @Field(() => [TicketTypeCountType])
  byType!: TicketTypeCountType[];

  @Field(() => [TicketPersonOptionType])
  people!: TicketPersonOptionType[];

  @Field(() => [UnitOptionType])
  units!: UnitOptionType[];
}
