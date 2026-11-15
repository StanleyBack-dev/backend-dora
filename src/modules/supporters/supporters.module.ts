import { Module } from "@nestjs/common";
import { SUPPORTER_REPOSITORY } from "@/modules/supporters/application/ports/supporter-repository.port";
import { DeleteSupportContributionUseCase } from "@/modules/supporters/application/use-cases/delete-support-contribution.use-case";
import { DeleteSupporterUseCase } from "@/modules/supporters/application/use-cases/delete-supporter.use-case";
import { GetSupportRankingUseCase } from "@/modules/supporters/application/use-cases/get-support-ranking.use-case";
import { ListSupportersUseCase } from "@/modules/supporters/application/use-cases/list-supporters.use-case";
import { RecordSupportContributionUseCase } from "@/modules/supporters/application/use-cases/record-support-contribution.use-case";
import { UpdateSupporterUseCase } from "@/modules/supporters/application/use-cases/update-supporter.use-case";
import { SupporterTypeormRepository } from "@/modules/supporters/infrastructure/persistence/typeorm/supporter-typeorm.repository";
import { SupportRankingResolver } from "@/modules/supporters/presentation/graphql/support-ranking.resolver";
import { SupportersResolver } from "@/modules/supporters/presentation/graphql/supporters.resolver";

// "Apoie o Dora": the supporters' ranking and the list the platform
// administrator keeps.
@Module({
  providers: [
    GetSupportRankingUseCase,
    ListSupportersUseCase,
    RecordSupportContributionUseCase,
    UpdateSupporterUseCase,
    DeleteSupporterUseCase,
    DeleteSupportContributionUseCase,
    SupportRankingResolver,
    SupportersResolver,
    { provide: SUPPORTER_REPOSITORY, useClass: SupporterTypeormRepository },
  ],
})
export class SupportersModule {}
