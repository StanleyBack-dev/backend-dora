import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import type {
  DeliveryBoardOverview,
  OrderBoardOverview,
} from "@/modules/purchases/application/ports/purchase-order-repository.port";
import {
  ListPurchaseOrdersUseCase,
  type OrderBoardRow,
  type OrderView,
} from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import { CancelPurchaseOrderUseCase } from "@/modules/purchases/application/use-cases/cancel-purchase-order.use-case";
import { SendPurchaseOrderEmailUseCase } from "@/modules/purchases/application/use-cases/send-purchase-order-email.use-case";
import { PlacePurchaseOrderUseCase } from "@/modules/purchases/application/use-cases/place-purchase-order.use-case";
import { PurchaseOrderPdfUseCase } from "@/modules/purchases/application/use-cases/purchase-order-pdf.use-case";
import { RatePurchaseSupplierUseCase } from "@/modules/purchases/application/use-cases/rate-purchase-supplier.use-case";
import { RecordPurchaseReceiptUseCase } from "@/modules/purchases/application/use-cases/record-purchase-receipt.use-case";
import {
  PlacePurchaseOrderInput,
  PurchaseReceiptInput,
} from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-order.input";
import { PurchaseEmailInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-email.input";
import { PurchaseRequestFilterInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-request-filter.input";
import {
  DeliveryBoardOverviewType,
  OrderBoardOverviewType,
  OrderBoardPage,
  PurchaseOrderFileType,
  PurchaseOrderViewType,
} from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-order.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };
const FILE_ARG = { type: () => String, nullable: true } as const;
const TEXT_ARG = { type: () => String, nullable: true } as const;

/**
 * After the approval: the orders and deliveries pages, a purchase's order
 * page, placing, sending and cancelling the order, the deliveries (the
 * management and the gate) and the supplier's rating (the management). The
 * use cases check who may do what (the gate receives without values).
 */
@RequireModule(AppModule.PURCHASES)
@Resolver()
export class PurchaseOrdersResolver {
  constructor(
    private readonly listing: ListPurchaseOrdersUseCase,
    private readonly placing: PlacePurchaseOrderUseCase,
    private readonly receiving: RecordPurchaseReceiptUseCase,
    private readonly cancelling: CancelPurchaseOrderUseCase,
    private readonly mailing: SendPurchaseOrderEmailUseCase,
    private readonly rating: RatePurchaseSupplierUseCase,
    private readonly pdf: PurchaseOrderPdfUseCase,
  ) {}

  @Query(() => OrderBoardPage, {
    description:
      "Compras aprovadas, com pedido feito, recebidas ou concluídas (para a portaria, só as com pedido, sem valores).",
  })
  orderBoard(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: PurchaseRequestFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<OrderBoardRow>> {
    return this.listing.list(actor, filter ?? {}, page ?? DEFAULT_PAGE);
  }

  @Query(() => OrderBoardOverviewType, {
    description: "Os pedidos em números (os cards da página).",
  })
  orderBoardOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<OrderBoardOverview> {
    return this.listing.overview(actor);
  }

  @Query(() => DeliveryBoardOverviewType, {
    description: "As entregas em números (os cards da página de recebimentos).",
  })
  deliveryBoardOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DeliveryBoardOverview> {
    return this.listing.deliveryOverview(actor);
  }

  @Query(() => PurchaseOrderViewType, {
    description: "O pedido de uma compra: itens, entregas e parcelas.",
  })
  purchaseOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
  ): Promise<OrderView> {
    return this.listing.view(actor, requestId);
  }

  @Query(() => PurchaseOrderFileType, {
    description: "A ordem de compra em PDF, para enviar ao fornecedor.",
  })
  async purchaseOrderPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
  ): Promise<PurchaseOrderFileType> {
    const file = await this.pdf.render(actor, requestId);
    return {
      fileName: file.fileName,
      mimeType: "application/pdf",
      base64Content: file.content.toString("base64"),
    };
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseOrderViewType, {
    description:
      "Faz o pedido de uma compra aprovada (gera a OC e as parcelas da cotação escolhida).",
  })
  placePurchaseOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("input") input: PlacePurchaseOrderInput,
  ): Promise<OrderView> {
    return this.placing.place(actor, requestId, {
      expectedOn: input.expectedOn ?? null,
      firstDueOn: input.firstDueOn,
      notes: input.notes ?? null,
    });
  }

  @Mutation(() => PurchaseOrderViewType, {
    description:
      "Registra uma entrega (toda ou em parte), com a nota fiscal (PDF ou imagem em base64).",
  })
  recordPurchaseReceipt(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("input") input: PurchaseReceiptInput,
    @Args("file", FILE_ARG) file?: string | null,
  ): Promise<OrderView> {
    return this.receiving.add(
      actor,
      requestId,
      {
        receivedOn: input.receivedOn,
        items: input.items,
        invoiceNumber: input.invoiceNumber ?? null,
        invoiceCents: input.invoiceCents ?? null,
        invoiceDate: input.invoiceDate ?? null,
        note: input.note ?? null,
      },
      file ?? null,
    );
  }

  @Mutation(() => PurchaseOrderViewType, {
    description: "Remove uma entrega registrada por engano.",
  })
  removePurchaseReceipt(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("receiptId", { type: () => ID }, UuidArg()) receiptId: string,
  ): Promise<OrderView> {
    return this.receiving.remove(actor, requestId, receiptId);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseOrderViewType, {
    nullable: true,
    description:
      "Cancela um pedido sem entrega nem pagamento, com o motivo: a compra volta a aprovada ou, com backToQuotes, às cotações (então devolve null).",
  })
  cancelPurchaseOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("reason") reason: string,
    @Args("backToQuotes", { type: () => Boolean, defaultValue: false })
    backToQuotes: boolean,
  ): Promise<OrderView | null> {
    return this.cancelling.cancel(actor, requestId, reason, backToQuotes);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => Int, {
    description:
      "Envia a ordem de compra por e-mail (PDF anexado); devolve quantos e-mails saíram.",
  })
  sendPurchaseOrderByEmail(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("input") input: PurchaseEmailInput,
  ): Promise<number> {
    return this.mailing.send(actor, requestId, input.emails, input.message);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseOrderViewType, {
    description:
      "Avalia o fornecedor de uma compra concluída (1 a 5 e um comentário).",
  })
  ratePurchaseSupplier(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("rating", { type: () => Int }) rating: number,
    @Args("comment", TEXT_ARG) comment?: string | null,
  ): Promise<OrderView> {
    return this.rating.rate(actor, requestId, rating, comment ?? null);
  }
}
