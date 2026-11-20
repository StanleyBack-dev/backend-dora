import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("CondominiumParcels", {
  description: "Encomendas recebidas por um condomínio no período.",
})
export class CondominiumParcelsType {
  @Field(() => ID)
  condominiumId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => Int)
  received!: number;

  @Field(() => Int)
  pickedUp!: number;
}
