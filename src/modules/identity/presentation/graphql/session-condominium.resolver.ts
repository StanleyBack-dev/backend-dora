import { ParseUUIDPipe } from "@nestjs/common";
import {
  Args,
  ID,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { AllowFirstAccess } from "@/common/decorators/allow-first-access.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import {
  CondominiumContextUseCase,
  type CurrentCondominium,
} from "@/modules/identity/application/use-cases/condominium-context.use-case";
import { CurrentCondominiumType } from "@/modules/identity/presentation/graphql/dto/outputs/current-condominium.output";
import { MemberCondominiumType } from "@/modules/identity/presentation/graphql/dto/outputs/member-condominium.output";
import { SessionUserType } from "@/modules/identity/presentation/graphql/dto/outputs/session-user.output";

import type { MemberCondominium } from "@/modules/identity/domain/membership";

// The session's condominium and the ones the person can switch to.
@Resolver(() => SessionUserType)
export class SessionCondominiumResolver {
  constructor(private readonly context: CondominiumContextUseCase) {}

  @ResolveField(() => CurrentCondominiumType, {
    nullable: true,
    description: "Condomínio atual (null: nenhum escolhido ou disponível).",
  })
  condominium(
    @Parent() parent: SessionUserType,
  ): Promise<CurrentCondominium | null> {
    return this.context.current(parent.condominiumId);
  }

  @ResolveField(() => [MemberCondominiumType], {
    description: "Condomínios que a pessoa pode abrir.",
  })
  condominiums(
    @Parent() parent: SessionUserType,
  ): Promise<MemberCondominium[]> {
    return this.context.mine(parent.id);
  }

  @AllowFirstAccess()
  @Mutation(() => Boolean, {
    description:
      "Troca o condomínio da sessão. null: sai de todos (visão da plataforma).",
  })
  async switchCondominium(
    @CurrentUser() user: AuthenticatedUser,
    @Args(
      "condominiumId",
      { type: () => ID, nullable: true },
      new ParseUUIDPipe({ version: "4", optional: true }),
    )
    condominiumId: string | null,
  ): Promise<boolean> {
    await this.context.switchTo(user, condominiumId ?? null);
    return true;
  }
}
