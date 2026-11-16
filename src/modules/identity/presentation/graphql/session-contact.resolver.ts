import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { SessionUserType } from "@/modules/identity/presentation/graphql/dto/outputs/session-user.output";

// The signed-in person's contact data and birth date (Meu perfil), read on
// demand so the
// session payload stays the same for every request.
@Resolver(() => SessionUserType)
export class SessionContactResolver {
  constructor(private readonly users: UserLookupService) {}

  @ResolveField(() => String, {
    nullable: true,
    description: "Telefone de contato (só dígitos: DDD + número).",
  })
  phone(@Parent() user: Pick<SessionUserType, "id">): Promise<string | null> {
    return this.users.phoneOf(user.id);
  }

  @ResolveField(() => String, {
    nullable: true,
    description: "Data de nascimento (AAAA-MM-DD).",
  })
  birthDate(
    @Parent() user: Pick<SessionUserType, "id">,
  ): Promise<string | null> {
    return this.users.birthDateOf(user.id);
  }
}
