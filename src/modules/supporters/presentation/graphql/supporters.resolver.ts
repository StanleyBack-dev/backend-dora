import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import type { SupporterWithContributions } from "@/modules/supporters/application/ports/supporter-repository.port";
import { DeleteSupportContributionUseCase } from "@/modules/supporters/application/use-cases/delete-support-contribution.use-case";
import { DeleteSupporterUseCase } from "@/modules/supporters/application/use-cases/delete-supporter.use-case";
import { ListSupportersUseCase } from "@/modules/supporters/application/use-cases/list-supporters.use-case";
import { RecordSupportContributionUseCase } from "@/modules/supporters/application/use-cases/record-support-contribution.use-case";
import { UpdateSupporterUseCase } from "@/modules/supporters/application/use-cases/update-supporter.use-case";
import type {
  SupportContribution,
  Supporter,
} from "@/modules/supporters/domain/supporter";
import { RecordSupportContributionInput } from "@/modules/supporters/presentation/graphql/dto/inputs/record-support-contribution.input";
import { UpdateSupporterInput } from "@/modules/supporters/presentation/graphql/dto/inputs/update-supporter.input";
import { SupportContributionType } from "@/modules/supporters/presentation/graphql/dto/outputs/support-contribution.output";
import { SupporterType } from "@/modules/supporters/presentation/graphql/dto/outputs/supporter.output";

// The platform administrator keeps the list of supporters: a static PIX
// code doesn't say who paid, so each contribution is recorded by hand.
@Resolver()
export class SupportersResolver {
  constructor(
    private readonly listing: ListSupportersUseCase,
    private readonly recording: RecordSupportContributionUseCase,
    private readonly updating: UpdateSupporterUseCase,
    private readonly deletingSupporter: DeleteSupporterUseCase,
    private readonly deletingContribution: DeleteSupportContributionUseCase,
  ) {}

  @RequirePermissions(Permission.SUPPORTERS_MANAGE)
  @Query(() => [SupporterType], {
    description: "Todos os apoiadores, com cada apoio (administração).",
  })
  supporters(): Promise<SupporterWithContributions[]> {
    return this.listing.execute();
  }

  @RequirePermissions(Permission.SUPPORTERS_MANAGE)
  @Mutation(() => SupportContributionType, {
    description:
      "Registra um apoio recebido por Pix. Um nome já cadastrado soma a esse apoiador.",
  })
  recordSupportContribution(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: RecordSupportContributionInput,
  ): Promise<SupportContribution> {
    return this.recording.execute(actor, input);
  }

  @RequirePermissions(Permission.SUPPORTERS_MANAGE)
  @Mutation(() => SupporterType, {
    description: "Corrige o nome do apoiador ou se ele aparece no ranking.",
  })
  async updateSupporter(
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: UpdateSupporterInput,
  ): Promise<Supporter & { history: SupportContribution[] }> {
    const supporter = await this.updating.execute(id, input);
    return { ...supporter, history: [] };
  }

  @RequirePermissions(Permission.SUPPORTERS_MANAGE)
  @Mutation(() => Boolean, {
    description: "Remove o apoiador e todos os apoios dele.",
  })
  async deleteSupporter(
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<boolean> {
    await this.deletingSupporter.execute(id);
    return true;
  }

  @RequirePermissions(Permission.SUPPORTERS_MANAGE)
  @Mutation(() => Boolean, { description: "Desfaz um apoio registrado." })
  async deleteSupportContribution(
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<boolean> {
    await this.deletingContribution.execute(id);
    return true;
  }
}
