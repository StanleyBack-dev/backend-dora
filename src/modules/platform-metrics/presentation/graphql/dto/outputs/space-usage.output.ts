import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("SpaceUsage", {
  description: "Uso de um espaço no período.",
})
export class SpaceUsageType {
  @Field(() => ID)
  spaceId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  condominiumName!: string;

  @Field(() => Int, {
    description: "Reservas ativas (pendentes ou confirmadas).",
  })
  bookings!: number;

  @Field(() => Float, { description: "Horas reservadas." })
  hours!: number;
}
