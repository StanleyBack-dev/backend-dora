import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import type {
  CondominiumMember,
  PlatformPerson,
} from "@/modules/platform-directory/application/ports/platform-directory-reader.port";
import { ListCondominiumMembersUseCase } from "@/modules/platform-directory/application/use-cases/list-condominium-members.use-case";
import { ListPlatformPeopleUseCase } from "@/modules/platform-directory/application/use-cases/list-platform-people.use-case";
import { PlatformPeopleFilterInput } from "@/modules/platform-directory/presentation/graphql/dto/inputs/platform-people-filter.input";
import { CondominiumMemberType } from "@/modules/platform-directory/presentation/graphql/dto/outputs/condominium-member.output";
import { PlatformPersonPage } from "@/modules/platform-directory/presentation/graphql/dto/outputs/platform-person.output";
import type { Paginated } from "@/shared/application/pagination";

// The platform directory (Plataforma, Pessoas, and each condominium page).
// CONDOMINIUMS_MANAGE: only the platform administrator.
@RequirePermissions(Permission.CONDOMINIUMS_MANAGE)
@Resolver()
export class PlatformDirectoryResolver {
  constructor(
    private readonly people: ListPlatformPeopleUseCase,
    private readonly members: ListCondominiumMembersUseCase,
  ) {}

  @Query(() => PlatformPersonPage, {
    description: "Todas as pessoas com conta no Dora, com os condomínios.",
  })
  platformPeople(
    @Args("filter", { type: () => PlatformPeopleFilterInput, nullable: true })
    filter: PlatformPeopleFilterInput | null,
    @Args("page", { type: () => PageInput, nullable: true })
    page: PageInput | null,
  ): Promise<Paginated<PlatformPerson>> {
    return this.people.execute(filter ?? {}, page ?? { page: 1, limit: 20 });
  }

  @Query(() => [CondominiumMemberType], {
    description: "As pessoas de um condomínio (gestão, portaria e moradores).",
  })
  condominiumMembers(
    @Args("condominiumId", { type: () => ID }, UuidArg())
    condominiumId: string,
  ): Promise<CondominiumMember[]> {
    return this.members.execute(condominiumId);
  }
}
