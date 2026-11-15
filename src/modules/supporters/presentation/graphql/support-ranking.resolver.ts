import { Args, Int, Query, Resolver } from "@nestjs/graphql";
import {
  GetSupportRankingUseCase,
  type SupportRanking,
} from "@/modules/supporters/application/use-cases/get-support-ranking.use-case";
import { SupportRankingType } from "@/modules/supporters/presentation/graphql/dto/outputs/support-ranking.output";

// The "Apoie o Dora" ranking: anyone signed in sees it.
@Resolver()
export class SupportRankingResolver {
  constructor(private readonly ranking: GetSupportRankingUseCase) {}

  @Query(() => SupportRankingType, {
    description: "Ranking de quem apoia o Dora: geral ou de um ano.",
  })
  supportRanking(
    @Args("year", { type: () => Int, nullable: true }) year?: number | null,
  ): Promise<SupportRanking> {
    return this.ranking.execute(year ?? null);
  }
}
