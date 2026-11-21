import { Inject } from "@nestjs/common";
import { Parent, ResolveField, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";
import { LostFoundDeclarationService } from "@/modules/lost-and-found/application/lost-found-declaration.service";
import { GetReturnReceiptUseCase } from "@/modules/lost-and-found/application/use-cases/get-return-receipt.use-case";
import { ListFoundItemsUseCase } from "@/modules/lost-and-found/application/use-cases/list-found-items.use-case";
import {
  FoundItemStatus,
  isKept,
} from "@/modules/lost-and-found/domain/found-item";
import { FoundItemClaimType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-claim.output";
import { FoundItemReturnType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item-return.output";
import { FoundItemType } from "@/modules/lost-and-found/presentation/graphql/dto/outputs/found-item.output";
import {
  toClaimType,
  toReturnType,
} from "@/modules/lost-and-found/presentation/graphql/found-item.mapper";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// What depends on who is asking: the photo (hidden from residents when
// asked, e.g. a document), the details only the staff sees, the item's
// claims (staff), the caller's own claim, the declaration to sign and the
// return (who took it and the receipt: the staff, or the resident it went
// back to). Every query that returns an item already checked the caller
// may see it.
@Resolver(() => FoundItemType)
export class FoundItemFieldsResolver {
  constructor(
    private readonly access: LostFoundAccessService,
    private readonly listing: ListFoundItemsUseCase,
    private readonly declarations: LostFoundDeclarationService,
    private readonly receipts: GetReturnReceiptUseCase,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  @ResolveField(() => String, {
    nullable: true,
    description:
      "Link temporário da foto (nulo para moradores quando a foto está escondida).",
  })
  async photoUrl(
    @Parent() item: FoundItemType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<string | null> {
    if (!item.photoKey) return null;
    if (item.photoHidden && !(await this.access.canManage(actor))) {
      return null;
    }
    return this.storage.signedReadUrl(item.photoKey);
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      "Detalhes para conferir o dono: só a portaria e a gestão veem.",
  })
  async privateDetails(
    @Parent() item: FoundItemType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<string | null> {
    if (!item.privateDetailsRaw) return null;
    return (await this.access.canManage(actor)) ? item.privateDetailsRaw : null;
  }

  @ResolveField(() => [FoundItemClaimType], {
    description:
      "Pedidos do item (só a portaria e a gestão; vazio para os demais).",
  })
  async claims(
    @Parent() item: FoundItemType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<FoundItemClaimType[]> {
    if (!(await this.access.canManage(actor))) return [];
    return (await this.listing.claimsOf(actor, item.id)).map(toClaimType);
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      "Morador com pedido aceito, que pode vir buscar (só a portaria e a gestão veem).",
  })
  async awaitedByName(
    @Parent() item: FoundItemType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<string | null> {
    if (!item.awaitedByNameRaw || item.status !== FoundItemStatus.FOUND) {
      return null;
    }
    return (await this.access.canManage(actor)) ? item.awaitedByNameRaw : null;
  }

  @ResolveField(() => FoundItemClaimType, {
    nullable: true,
    description: "O pedido mais recente de quem consulta (nulo: não pediu).",
  })
  async myClaim(
    @Parent() item: FoundItemType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<FoundItemClaimType | null> {
    const mine = await this.listing.myClaimOf(actor, item.id);
    return mine ? toClaimType(mine) : null;
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      "Morador a quem foi devolvido (pelo pedido dele). Só a portaria, a gestão e o próprio morador veem.",
  })
  async returnedToName(
    @Parent() item: FoundItemType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<string | null> {
    return (await this.seesReturn(item, actor)) ? item.returnedToNameRaw : null;
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      "Quem assinou. Só a portaria, a gestão e o morador a quem foi devolvido veem.",
  })
  async signerName(
    @Parent() item: FoundItemType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<string | null> {
    return (await this.seesReturn(item, actor)) ? item.signerNameRaw : null;
  }

  @ResolveField(() => String, {
    nullable: true,
    description:
      'A declaração que quem retira assina, sem o começo "Eu, <nome>, ". Só enquanto está guardado.',
  })
  async returnDeclaration(
    @Parent() item: FoundItemType,
  ): Promise<string | null> {
    if (!isKept(item.status)) return null;
    return this.declarations.forItem(item);
  }

  @ResolveField(() => FoundItemReturnType, {
    nullable: true,
    description:
      "Comprovante da devolução (só itens devolvidos; para a portaria, a gestão e o morador a quem foi devolvido).",
  })
  async returnReceipt(
    @Parent() item: FoundItemType,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<FoundItemReturnType | null> {
    if (item.status !== FoundItemStatus.RETURNED) return null;
    if (!(await this.seesReturn(item, actor))) return null;
    const record = await this.receipts.execute(item.id);
    if (!record) return null;
    const imageUrl = await this.storage.signedReadUrl(record.imageKey);
    return toReturnType(record, imageUrl);
  }

  /** The staff, or the resident whose claim the return answered. */
  private async seesReturn(
    item: FoundItemType,
    actor: AuthenticatedUser,
  ): Promise<boolean> {
    if (item.returnedToId !== null && item.returnedToId === actor.id) {
      return true;
    }
    return this.access.canManage(actor);
  }
}
