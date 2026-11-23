import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { RequireModule } from "@/modules/condominiums/presentation/decorators/require-module.decorator";
import type { InstallmentBoardOverview } from "@/modules/purchases/application/ports/purchase-order-repository.port";
import type { OrderView } from "@/modules/purchases/application/use-cases/list-purchase-orders.use-case";
import {
  ListPurchasePaymentsUseCase,
  type PaymentBoardRow,
} from "@/modules/purchases/application/use-cases/list-purchase-payments.use-case";
import { PayPurchaseInstallmentUseCase } from "@/modules/purchases/application/use-cases/pay-purchase-installment.use-case";
import { ReschedulePurchaseInstallmentUseCase } from "@/modules/purchases/application/use-cases/reschedule-purchase-installment.use-case";
import { PaymentFilterInput } from "@/modules/purchases/presentation/graphql/dto/inputs/payment-filter.input";
import { PurchasePaymentInput } from "@/modules/purchases/presentation/graphql/dto/inputs/purchase-order.input";
import { PurchaseOrderViewType } from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-order.output";
import {
  PaymentBoardOverviewType,
  PaymentBoardPage,
} from "@/modules/purchases/presentation/graphql/dto/outputs/purchase-payment.output";
import type { Paginated } from "@/shared/application/pagination";

const DEFAULT_PAGE = { page: 1, limit: 20 };
const FILE_ARG = { type: () => String, nullable: true } as const;

/**
 * The payments to the suppliers (contas a pagar): the installments of every
 * placed order, read by the management and the approvers; paying, undoing a
 * payment and moving a due day, by the management.
 */
@RequireModule(AppModule.PURCHASES)
@Resolver()
export class PurchasePaymentsResolver {
  constructor(
    private readonly listing: ListPurchasePaymentsUseCase,
    private readonly paying: PayPurchaseInstallmentUseCase,
    private readonly rescheduling: ReschedulePurchaseInstallmentUseCase,
  ) {}

  @Query(() => PaymentBoardPage, {
    description: "As parcelas dos pedidos, pelo vencimento.",
  })
  paymentBoard(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("filter", { nullable: true }) filter?: PaymentFilterInput,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<PaymentBoardRow>> {
    return this.listing.list(actor, filter ?? {}, page ?? DEFAULT_PAGE);
  }

  @Query(() => PaymentBoardOverviewType, {
    description: "As contas a pagar em números (os cards da página).",
  })
  paymentBoardOverview(
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<InstallmentBoardOverview> {
    return this.listing.overview(actor);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseOrderViewType, {
    description:
      "Marca uma parcela como paga, com o comprovante (PDF ou imagem em base64).",
  })
  payPurchaseInstallment(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("installmentId", { type: () => ID }, UuidArg())
    installmentId: string,
    @Args("input") input: PurchasePaymentInput,
    @Args("file", FILE_ARG) file?: string | null,
  ): Promise<OrderView> {
    return this.paying.pay(
      actor,
      requestId,
      installmentId,
      { paidOn: input.paidOn, note: input.note ?? null },
      file ?? null,
    );
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseOrderViewType, {
    description: "Desfaz o pagamento de uma parcela marcada por engano.",
  })
  unpayPurchaseInstallment(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("installmentId", { type: () => ID }, UuidArg())
    installmentId: string,
  ): Promise<OrderView> {
    return this.paying.unpay(actor, requestId, installmentId);
  }

  @RequirePermissions(Permission.PURCHASES_MANAGE)
  @Mutation(() => PurchaseOrderViewType, {
    description: "Muda o vencimento de uma parcela ainda não paga.",
  })
  reschedulePurchaseInstallment(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("requestId", { type: () => ID }, UuidArg()) requestId: string,
    @Args("installmentId", { type: () => ID }, UuidArg())
    installmentId: string,
    @Args("dueOn") dueOn: string,
  ): Promise<OrderView> {
    return this.rescheduling.reschedule(actor, requestId, installmentId, dueOn);
  }
}
