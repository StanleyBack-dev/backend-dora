import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import { ChoosePurchaseQuoteUseCase } from "@/modules/purchases/application/use-cases/choose-purchase-quote.use-case";
import {
  ListPurchaseQuotesUseCase,
  type QuoteView,
} from "@/modules/purchases/application/use-cases/list-purchase-quotes.use-case";
import { ShareQuoteMapUseCase } from "@/modules/purchases/application/use-cases/share-quote-map.use-case";
import { SavePurchaseQuoteUseCase } from "@/modules/purchases/application/use-cases/save-purchase-quote.use-case";
import { ShareQuoteMapInput } from "@/modules/purchases/presentation/graphql/dto/inputs/share-quote-map.input";
import { PurchaseQuoteInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-quote.input";
import { PurchaseQuoteMapFileType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-quote-map-file.output";
import { PurchaseQuoteType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-quote.output";
import { PurchaseRequestType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-request.output";

/** Base64 of a PDF or image of up to 1.2 MB (the use case checks it). */
const FILE_ARG = { type: () => String, nullable: true } as const;

// The quotes of a purchase request: recorded per supplier, compared and
// one chosen by the management (PURCHASES_MANAGE on each change); read, as
// the comparison map (screen, PDF, shared by e-mail), by the management and
// the approvers (checked by the use case).
@RequireModule(AppModule.PURCHASES)
@Resolver()
export class PurchaseQuotesResolver {
  constructor(
    private readonly listing: ListPurchaseQuotesUseCase,
    private readonly saving: SavePurchaseQuoteUseCase,
    private readonly choosing: ChoosePurchaseQuoteUseCase,
    private readonly sharing: ShareQuoteMapUseCase,
  ) {}

  @Mutation(() => Int, {
    description:
      "Envia o mapa de cotação em PDF por e-mail (um e-mail por endereço); devolve quantos foram.",
  })
  sharePurchaseQuoteMapByEmail(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("input") input: ShareQuoteMapInput,
  ): Promise<number> {
    return this.sharing.byEmail(actor, requestId, input.emails, input.message);
  }

  @Query(() => [PurchaseQuoteType], {
    description:
      "As cotações de uma solicitação, com os totais, a mais barata e a escolhida.",
  })
  purchaseQuotes(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
  ): Promise<QuoteView[]> {
    return this.listing.list(actor, requestId);
  }

  @Query(() => PurchaseQuoteMapFileType, {
    description: "O mapa de cotação da solicitação, em PDF.",
  })
  async purchaseQuoteMapPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
  ): Promise<PurchaseQuoteMapFileType> {
    const file = await this.listing.mapPdf(actor, requestId);
    return {
      fileName: file.fileName,
      mimeType: "application/pdf",
      base64Content: file.content.toString("base64"),
    };
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseQuoteType, {
    description:
      "Registra a cotação de um fornecedor (a primeira põe a solicitação em cotação).",
  })
  addPurchaseQuote(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("supplierId", { type: () => ID }, UuidArg()) supplierId: string,
    @Args("input") input: PurchaseQuoteInput,
    @Args("file", FILE_ARG) file?: string | null,
  ): Promise<QuoteView> {
    return this.saving
      .add(actor, requestId, supplierId, input, file ?? null)
      .then((quote) => this.listing.one(actor, quote.requestId, quote.id));
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseQuoteType, {
    description:
      "Altera uma cotação (preços, condições e o orçamento: novo arquivo, mantido ou removido).",
  })
  updatePurchaseQuote(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: PurchaseQuoteInput,
    @Args("file", FILE_ARG) file?: string | null,
    @Args("removeFile", { type: () => Boolean, defaultValue: false })
    removeFile?: boolean,
  ): Promise<QuoteView> {
    return this.saving
      .update(
        actor,
        id,
        input,
        file
          ? { kind: "replace", base64: file }
          : removeFile
            ? { kind: "remove" }
            : { kind: "keep" },
      )
      .then((quote) => this.listing.one(actor, quote.requestId, quote.id));
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => Boolean, {
    description:
      "Remove uma cotação (sem nenhuma, a solicitação volta a aguardar cotação).",
  })
  async removePurchaseQuote(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<boolean> {
    await this.saving.remove(actor, id);
    return true;
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseRequestType, {
    description:
      "Escolhe a cotação vencedora (justificativa obrigatória se não for a mais barata ou houver menos de 3); a solicitação passa a aguardar aprovação.",
  })
  choosePurchaseQuote(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("justification", { type: () => String, nullable: true })
    justification?: string | null,
  ): Promise<PurchaseRequestType> {
    return this.choosing.choose(actor, id, justification ?? null);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseRequestType, {
    description:
      "Desfaz a escolha enquanto aguarda aprovação: a solicitação volta para cotação.",
  })
  reopenPurchaseQuotes(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
  ): Promise<PurchaseRequestType> {
    return this.choosing.reopen(actor, requestId);
  }
}
