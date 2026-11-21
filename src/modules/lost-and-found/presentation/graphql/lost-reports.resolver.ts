import { Inject } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import { ListLostReportsUseCase } from "@/modules/lost-and-found/application/use-cases/list-lost-reports.use-case";
import { ReportLostItemUseCase } from "@/modules/lost-and-found/application/use-cases/report-lost-item.use-case";
import { SpotLostReportUseCase } from "@/modules/lost-and-found/application/use-cases/spot-lost-report.use-case";
import { ReportLostItemInput } from "@/modules/lost-and-found/presentation/graphql/dto/inputs/report-lost-item.input";
import {
  LostReportBoardPage,
  type LostReportBoardItemType,
} from "@/modules/lost-and-found/presentation/graphql/dto/outputs/lost-report-board.output";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { LostReportPage } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/lost-report-page.output";
import { LostReportType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/lost-report.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };

// "Perdi algo": anyone of the condominium says what they lost and is told
// when an item of that category is found; the desk sees what people are
// looking for.
@RequireModule(AppModule.LOST_AND_FOUND)
@Resolver()
export class LostReportsResolver {
  constructor(
    private readonly reporting: ReportLostItemUseCase,
    private readonly listing: ListLostReportsUseCase,
    private readonly spotting: SpotLostReportUseCase,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @Query(() => LostReportBoardPage, {
    description:
      'Mural "Procura-se": o que os vizinhos perderam e escolheram mostrar (sem quem perdeu nem os detalhes).',
  })
  async lostReportBoard(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<LostReportBoardItemType>> {
    const found = await this.spotting.board(actor, page ?? DEFAULT_PAGE);
    // Only what the neighbours may see: never who lost it nor the details.
    const items = await Promise.all(
      found.items.map(async (report) => ({
        id: report.id,
        category: report.category,
        title: report.title,
        lostLocation: report.lostLocation,
        lostOn: report.lostOn,
        photoUrl: report.photoKey
          ? await this.storage.signedReadUrl(report.photoKey)
          : null,
        mine: report.userId === actor.id,
        spottedByMe: report.spottedByMe,
        createdAt: report.createdAt,
      })),
    );
    return { ...found, items };
  }

  @Mutation(() => Boolean, {
    description:
      '"Achei isso": diz que achou um item do mural; quem perdeu e a portaria são avisados.',
  })
  async spotLostReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("note", { type: () => String, nullable: true }) note?: string | null,
  ): Promise<boolean> {
    await this.spotting.spot(actor, id, note);
    return true;
  }

  @Query(() => LostReportPage, {
    description: "Os meus avisos de itens perdidos (os abertos primeiro).",
  })
  myLostReports(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<LostReportType>> {
    return this.listing.mine(actor, page ?? DEFAULT_PAGE);
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Query(() => LostReportPage, {
    description:
      "Avisos de itens perdidos do condomínio: os abertos (procurando) ou os encerrados.",
  })
  lostReports(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("open", { type: () => Boolean, nullable: true }) open?: boolean,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<LostReportType>> {
    return this.listing.all(actor, open ?? true, page ?? DEFAULT_PAGE);
  }

  @Mutation(() => LostReportType, {
    description:
      '"Perdi algo": avisa o que perdeu; quando a portaria registrar um item da mesma categoria, você é avisado.',
  })
  reportLostItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: ReportLostItemInput,
  ): Promise<LostReportType> {
    return this.reporting.report(actor, input);
  }

  @Mutation(() => LostReportType, {
    description:
      "Encerra o meu aviso: encontrei (found = true) ou não procuro mais.",
  })
  closeLostReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("found", { type: () => Boolean }) found: boolean,
  ): Promise<LostReportType> {
    return this.reporting.close(actor, id, found);
  }
}
