import { ParseUUIDPipe } from "@nestjs/common";
import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import type { SupportRequestView } from "@/modules/support/application/ports/support-repository.port";
import {
  SupportUseCase,
  type SupportQuota,
} from "@/modules/support/application/use-cases/support.use-case";
import { SupportStatus } from "@/modules/support/domain/support-request";
import type { Paginated as PaginatedResult } from "@/shared/application/pagination";
import { SupportRequestType } from "@/modules/support/presentation/graphql/dto/outputs/support-request.output";
import { SupportQuotaType } from "@/modules/support/presentation/graphql/dto/outputs/support-quota.output";
import { SupportRequestPage } from "@/modules/support/presentation/graphql/dto/outputs/support-request-page.output";
import { SupportRequestInput } from "@/modules/support/presentation/graphql/dto/inputs/support-request.input";
import "@/modules/support/presentation/graphql/support.graphql-enums";

const Id = () => new ParseUUIDPipe({ version: "4" });

// Everyone signed in asks and follows their own requests; answering and
// closing them is for who manages support (ADMIN_MASTER).
@Resolver()
export class SupportResolver {
  constructor(private readonly support: SupportUseCase) {}

  @Query(() => SupportQuotaType, {
    description: "Quantas solicitações de suporte ainda posso enviar hoje.",
  })
  supportQuota(@CurrentUser() user: AuthenticatedUser): Promise<SupportQuota> {
    return this.support.quota(user.id);
  }

  @Query(() => SupportRequestPage, {
    description: "Minhas solicitações de suporte, das mais recentes.",
  })
  mySupportRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<SupportRequestView>> {
    return this.support.mine(user, page ?? { page: 1, limit: 10 });
  }

  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @Query(() => SupportRequestPage, {
    description: "Todas as solicitações de suporte (administração).",
  })
  supportRequests(
    @Args("status", { type: () => SupportStatus, nullable: true })
    status?: SupportStatus | null,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<PaginatedResult<SupportRequestView>> {
    return this.support.list(
      { status: status ?? undefined },
      page ?? { page: 1, limit: 10 },
    );
  }

  @Mutation(() => SupportRequestType, {
    description:
      "Envia uma solicitação de suporte (até 3 por dia); avisa os administradores.",
  })
  sendSupportRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Args("input") input: SupportRequestInput,
  ): Promise<SupportRequestView> {
    return this.support.send(user, input);
  }

  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @Mutation(() => SupportRequestType, {
    description: "Responde a solicitação; quem pediu é avisado.",
  })
  replySupportRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
    @Args("reply") reply: string,
  ): Promise<SupportRequestView> {
    return this.support.reply(user, id, reply);
  }

  @RequirePermissions(Permission.SUPPORT_MANAGE)
  @Mutation(() => SupportRequestType, {
    description: "Finaliza a solicitação; quem pediu é avisado.",
  })
  finalizeSupportRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Args("id", { type: () => ID }, Id()) id: string,
  ): Promise<SupportRequestView> {
    return this.support.finalize(user, id);
  }
}
