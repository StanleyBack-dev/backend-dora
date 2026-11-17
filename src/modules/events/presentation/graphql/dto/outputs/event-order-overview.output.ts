import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import { UnitOptionType } from "@/modules/events/presentation/graphql/dto/outputs/unit-option.output";
import "@/modules/events/presentation/graphql/events.graphql-enums";

@ObjectType("OrderStatusCount")
export class OrderStatusCountType {
  @Field(() => EventOrderStatus)
  status!: EventOrderStatus;

  @Field(() => Int)
  count!: number;
}

@ObjectType("OrderBuyerOption", {
  description: "Quem fez pedidos, para escolher num filtro.",
})
export class OrderBuyerOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;
}

@ObjectType("OrderCodeOption", {
  description: "O código de um pedido, para escolher num filtro.",
})
export class OrderCodeOptionType {
  @Field()
  code!: string;

  @Field(() => String, { nullable: true })
  buyerName!: string | null;
}

@ObjectType("EventOrderOverview", {
  description:
    "Os números dos pedidos de um evento (sem filtros) e as opções dos filtros.",
})
export class EventOrderOverviewType {
  @Field(() => [OrderStatusCountType])
  byStatus!: OrderStatusCountType[];

  @Field(() => Int, {
    description: "Recebido nos pedidos confirmados (centavos).",
  })
  receivedCents!: number;

  @Field(() => Int, { description: "Pessoas nos pedidos confirmados." })
  confirmedPeople!: number;

  @Field(() => [OrderBuyerOptionType])
  buyers!: OrderBuyerOptionType[];

  @Field(() => [UnitOptionType])
  units!: UnitOptionType[];

  @Field(() => [OrderCodeOptionType])
  codes!: OrderCodeOptionType[];
}
