import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { ClaimFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/claim-found-item.use-case";
import { CloseFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/close-found-item.use-case";
import { DecideClaimUseCase } from "@/modules/lost-and-found/application/use-cases/decide-claim.use-case";
import { ListFoundItemsUseCase } from "@/modules/lost-and-found/application/use-cases/list-found-items.use-case";
import { RegisterFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/register-found-item.use-case";
import { ReleaseFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/release-found-item.use-case";
import { ReturnFoundItemUseCase } from "@/modules/lost-and-found/application/use-cases/return-found-item.use-case";
import { SearchFoundItemOwnersUseCase } from "@/modules/lost-and-found/application/use-cases/search-found-item-owners.use-case";
import { FoundItemOwnerOptionType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-owner-option.output";
import {
  FoundItemCategory,
  FoundItemStatus,
} from "@/modules/lost-and-found/domain/found-item";
import { FoundItemFilterInput } from "@/modules/lost-and-found/presentation/graphql/dto/inputs/found-item-filter.input";
import { RegisterFoundItemInput } from "@/modules/lost-and-found/presentation/graphql/dto/inputs/register-found-item.input";
import { ReturnFoundItemInput } from "@/modules/lost-and-found/presentation/graphql/dto/inputs/return-found-item.input";
import { FoundItemClaimPage } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-claim-page.output";
import { FoundItemClaimType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-claim.output";
import { FoundItemOverviewType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-overview.output";
import { FoundItemPage } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-page.output";
import { FoundItemType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item.output";
import {
  toClaimType,
  toFoundItemType,
} from "@/modules/lost-and-found/presentation/graphql/found-item.mapper";
import type { Paginated } from "@/shared/application/pagination";
import "@/modules/lost-and-found/presentation/graphql/lost-found.graphql-enums";

const DEFAULT_PAGE = { page: 1, limit: 20 };

// Lost and found of the session's condominium: the gate and the managers
// register items, check claims, hand them back (with a signature) and
// donate or discard them; residents browse what is kept and claim theirs.
@RequireModule(AppModule.LOST_AND_FOUND)
@Resolver()
export class LostFoundResolver {
  constructor(
    private readonly access: LostFoundAccessService,
    private readonly listing: ListFoundItemsUseCase,
    private readonly registering: RegisterFoundItemUseCase,
    private readonly claiming: ClaimFoundItemUseCase,
    private readonly deciding: DecideClaimUseCase,
    private readonly returning: ReturnFoundItemUseCase,
    private readonly closing: CloseFoundItemUseCase,
    private readonly releasing: ReleaseFoundItemUseCase,
    private readonly owners: SearchFoundItemOwnersUseCase,
  ) {}

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Query(() => [FoundItemOwnerOptionType], {
    description:
      "Moradores (com a unidade) pelo nome, para indicar de quem é um item.",
  })
  foundItemOwners(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("search") search: string,
  ): Promise<FoundItemOwnerOptionType[]> {
    return this.owners.execute(actor, search);
  }

  @Mutation(() => FoundItemType, {
    description:
      "Tira a reserva de um item: o dono diz que não é dele (a portaria é avisada), ou a portaria libera para todos.",
  })
  async releaseFoundItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<FoundItemType> {
    return toFoundItemType(await this.releasing.execute(actor, id));
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Query(() => FoundItemPage, {
    description: "Itens achados do condomínio, com filtros, por página.",
  })
  async foundItems(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: FoundItemFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<FoundItemType>> {
    const found = await this.listing.all(
      actor,
      {
        statuses: filter?.statuses?.length ? filter.statuses : null,
        category: filter?.category ?? null,
        search: filter?.search?.trim() || null,
        withPendingClaims: filter?.withPendingClaims ?? false,
        title: filter?.title?.trim() || null,
        foundLocation: filter?.foundLocation?.trim() || null,
        storageLocation: filter?.storageLocation?.trim() || null,
        residentId: filter?.residentId ?? null,
        from: filter?.from ?? null,
        to: filter?.to ?? null,
      },
      page ?? DEFAULT_PAGE,
    );
    return { ...found, items: found.items.map(toFoundItemType) };
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Query(() => FoundItemOverviewType, {
    description: "Os itens achados em números.",
  })
  foundItemOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<FoundItemOverviewType> {
    return this.listing.overview(actor);
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Query(() => FoundItemClaimPage, {
    description:
      "Pedidos de itens achados do condomínio: os abertos (aguardando ou aceitos, de itens guardados) em fila, ou todos.",
  })
  async foundItemClaims(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("open", { type: () => Boolean, nullable: true }) open?: boolean,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<FoundItemClaimType>> {
    const found = await this.listing.claims(
      actor,
      open ?? true,
      page ?? DEFAULT_PAGE,
    );
    return { ...found, items: found.items.map(toClaimType) };
  }

  @Query(() => FoundItemPage, {
    description:
      "Itens achados ainda guardados (o que os moradores consultam).",
  })
  async keptFoundItems(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("category", { type: () => FoundItemCategory, nullable: true })
    category?: FoundItemCategory | null,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<FoundItemType>> {
    const found = await this.listing.kept(
      actor,
      category ?? null,
      page ?? DEFAULT_PAGE,
    );
    return { ...found, items: found.items.map(toFoundItemType) };
  }

  @Query(() => FoundItemType, {
    description:
      "Um item achado (portaria e gestão: qualquer um; morador: os guardados e os que pediu).",
  })
  async foundItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<FoundItemType> {
    return toFoundItemType(await this.access.loadVisible(actor, id));
  }

  @Query(() => FoundItemClaimPage, {
    description: "Os meus pedidos de itens achados.",
  })
  async myFoundItemClaims(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<FoundItemClaimType>> {
    const found = await this.listing.myClaims(actor, page ?? DEFAULT_PAGE);
    return { ...found, items: found.items.map(toClaimType) };
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Mutation(() => FoundItemType, {
    description: "Registra um item achado no condomínio.",
  })
  async registerFoundItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: RegisterFoundItemInput,
  ): Promise<FoundItemType> {
    return toFoundItemType(await this.registering.execute(actor, input));
  }

  @Mutation(() => FoundItemClaimType, {
    description:
      "Diz que um item achado é seu (uma descrição é opcional): a portaria confere na retirada.",
  })
  async claimFoundItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("itemId", { type: () => ID }, UuidArg()) itemId: string,
    @Args("message", { type: () => String, nullable: true })
    message: string | null,
  ): Promise<FoundItemClaimType> {
    return toClaimType(await this.claiming.claim(actor, itemId, message));
  }

  @Mutation(() => FoundItemClaimType, {
    description: "Cancela um pedido seu ainda aguardando.",
  })
  async withdrawFoundItemClaim(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("claimId", { type: () => ID }, UuidArg()) claimId: string,
  ): Promise<FoundItemClaimType> {
    return toClaimType(await this.claiming.withdraw(actor, claimId));
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Mutation(() => FoundItemClaimType, {
    description:
      "Aceita ou recusa um pedido (recusar pede o motivo, que o morador recebe).",
  })
  async decideFoundItemClaim(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("claimId", { type: () => ID }, UuidArg()) claimId: string,
    @Args("accept") accept: boolean,
    @Args("note", { type: () => String, nullable: true }) note?: string | null,
  ): Promise<FoundItemClaimType> {
    return toClaimType(
      await this.deciding.execute(actor, claimId, accept, note),
    );
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Mutation(() => FoundItemType, {
    description:
      "Devolve o item, com a assinatura de quem retira feita na tela.",
  })
  async returnFoundItem(
    @CurrentUser() actor: AuthenticatedUser,
    @CurrentRequestMeta() meta: RequestMeta,
    @Args("input") input: ReturnFoundItemInput,
  ): Promise<FoundItemType> {
    return toFoundItemType(
      await this.returning.execute(
        actor,
        { ...input, device: input.device ? { ...input.device } : null },
        meta,
      ),
    );
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Mutation(() => FoundItemType, {
    description: "Registra que o item foi doado, com o motivo.",
  })
  async donateFoundItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<FoundItemType> {
    return toFoundItemType(
      await this.closing.execute(actor, id, FoundItemStatus.DONATED, reason),
    );
  }

  @RequirePermissions(Permission.LOST_FOUND_MANAGE)
  @Mutation(() => FoundItemType, {
    description: "Registra que o item foi descartado, com o motivo.",
  })
  async discardFoundItem(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<FoundItemType> {
    return toFoundItemType(
      await this.closing.execute(actor, id, FoundItemStatus.DISCARDED, reason),
    );
  }
}
