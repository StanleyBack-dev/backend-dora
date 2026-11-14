import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("UsageByWeekday", {
  description: "Reservas por dia da semana.",
})
export class UsageByWeekdayType {
  @Field(() => Int, { description: "0 = domingo … 6 = sábado." })
  weekday!: number;

  @Field(() => Int)
  bookings!: number;
}
