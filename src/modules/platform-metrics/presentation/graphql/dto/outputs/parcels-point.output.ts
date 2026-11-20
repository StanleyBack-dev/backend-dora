import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("ParcelsPoint", {
  description: "Encomendas recebidas em um intervalo da série.",
})
export class ParcelsPointType {
  @Field(() => String, {
    description: "Primeiro dia do intervalo (YYYY-MM-DD).",
  })
  bucket!: string;

  @Field(() => Int, { description: "Recebidas no intervalo." })
  received!: number;

  @Field(() => Int, { description: "Delas, já retiradas." })
  pickedUp!: number;
}
