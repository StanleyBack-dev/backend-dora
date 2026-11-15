import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("SeriesCancellation", {
  description: "Resultado do cancelamento de uma recorrente.",
})
export class SeriesCancellationType {
  @Field(() => Int, { description: "Datas canceladas agora." })
  cancelled!: number;

  @Field(() => Int, {
    description: "Datas mantidas (fora do prazo de cancelamento).",
  })
  kept!: number;
}
