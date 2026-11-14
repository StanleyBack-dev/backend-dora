import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("UsageByHour", {
  description: "Reservas pelo horário de início.",
})
export class UsageByHourType {
  @Field(() => Int, { description: "0–23, no fuso do app." })
  hour!: number;

  @Field(() => Int)
  bookings!: number;
}
