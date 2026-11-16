import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { AddDependentUseCase } from "@/modules/dependents/application/use-cases/add-dependent.use-case";
import { ListMyDependentsUseCase } from "@/modules/dependents/application/use-cases/list-my-dependents.use-case";
import { RemoveDependentUseCase } from "@/modules/dependents/application/use-cases/remove-dependent.use-case";
import type { Dependent } from "@/modules/dependents/domain/dependent";
import { DependentInput } from "@/modules/dependents/presentation/graphql/dto/inputs/dependent.input";
import { DependentType } from "@/modules/dependents/presentation/graphql/dto/outputs/dependent.output";

// A resident's own dependents.
@Resolver()
export class DependentsResolver {
  constructor(
    private readonly listing: ListMyDependentsUseCase,
    private readonly adding: AddDependentUseCase,
    private readonly removing: RemoveDependentUseCase,
  ) {}

  @Query(() => [DependentType], { description: "Os meus dependentes." })
  myDependents(@CurrentUser() actor: AuthenticatedUser): Promise<Dependent[]> {
    return this.listing.execute(actor);
  }

  @Mutation(() => DependentType, {
    description:
      "Cadastra um dependente com o documento: fica aguardando a aprovação da administração.",
  })
  addDependent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: DependentInput,
  ): Promise<Dependent> {
    const { document, ...data } = input;
    return this.adding.execute(actor, data, document);
  }

  @Mutation(() => Boolean, { description: "Remove um dos meus dependentes." })
  removeDependent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<boolean> {
    return this.removing.execute(actor, id);
  }
}
