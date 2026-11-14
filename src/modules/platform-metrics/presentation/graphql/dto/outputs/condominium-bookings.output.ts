import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("CondominiumBookings", {
  description: "Reservas de um condomínio no período.",
})
export class CondominiumBookingsType {
  @Field(() => ID)
  condominiumId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  cancelled!: number;
}
