import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("GuestFilterOption", {
  description: "Algo para escolher num filtro dos convidados.",
})
export class GuestFilterOptionType {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;
}

@ObjectType("DayGuestsOverview", {
  description:
    "Os números dos convidados de um dia (sem filtros) e as opções dos filtros.",
})
export class DayGuestsOverviewType {
  @Field(() => Int)
  total!: number;

  @Field(() => Int, { description: "Quantos já entraram." })
  checkedIn!: number;

  @Field(() => Int, { description: "Quantas reservas têm convidados." })
  bookings!: number;

  @Field(() => [GuestFilterOptionType])
  guests!: GuestFilterOptionType[];

  @Field(() => [GuestFilterOptionType], { description: "Quem convidou." })
  hosts!: GuestFilterOptionType[];

  @Field(() => [GuestFilterOptionType])
  units!: GuestFilterOptionType[];

  @Field(() => [GuestFilterOptionType])
  spaces!: GuestFilterOptionType[];
}
