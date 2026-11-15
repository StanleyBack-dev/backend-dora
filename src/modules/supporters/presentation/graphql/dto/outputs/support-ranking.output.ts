import { Field, Int, ObjectType } from "@nestjs/graphql";
import { SupportRankingEntryType } from "@/modules/supporters/presentation/graphql/dto/outputs/support-ranking-entry.output";

@ObjectType("SupportRanking", {
  description: "Ranking de quem apoia o Dora, geral ou de um ano.",
})
export class SupportRankingType {
  @Field(() => Int, { nullable: true, description: "Nulo: todos os anos." })
  year!: number | null;

  @Field(() => Int, { description: "Apoiadores no período." })
  supporters!: number;

  @Field(() => Int, { description: "Total recebido no período." })
  totalCents!: number;

  @Field(() => [SupportRankingEntryType], {
    description: "Os maiores apoiadores (até 20).",
  })
  entries!: SupportRankingEntryType[];
}
