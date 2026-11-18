import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("FeeFilterOption", {
  description: "Algo para escolher num filtro das taxas de uso.",
})
export class FeeFilterOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;
}

@ObjectType("BookingFeesOverview", {
  description:
    "Os números das taxas de uso de um mês (sem filtros) e as opções dos filtros.",
})
export class BookingFeesOverviewType {
  @Field(() => String, { description: "YYYY-MM." })
  month!: string;

  @Field(() => Int, { description: "Quantas taxas." })
  count!: number;

  @Field(() => Int)
  totalCents!: number;

  @Field(() => Int, { description: "Já lançado na cobrança." })
  billedCents!: number;

  @Field(() => [FeeFilterOptionType])
  units!: FeeFilterOptionType[];

  @Field(() => [FeeFilterOptionType])
  spaces!: FeeFilterOptionType[];

  @Field(() => [FeeFilterOptionType], { description: "Quem reservou." })
  users!: FeeFilterOptionType[];
}
