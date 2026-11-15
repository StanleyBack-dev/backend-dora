import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("SupportRankingEntry")
export class SupportRankingEntryType {
  @Field(() => Int, { description: "Totais iguais dividem a posição." })
  position!: number;

  @Field(() => String, {
    nullable: true,
    description: "Nulo: o apoiador preferiu não mostrar o nome.",
  })
  name!: string | null;

  @Field(() => Int)
  totalCents!: number;

  @Field(() => Int)
  contributions!: number;
}
