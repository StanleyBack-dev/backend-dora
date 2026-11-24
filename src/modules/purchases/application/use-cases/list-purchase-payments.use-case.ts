import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import {
  type InstallmentBoardOverview,
  type InstallmentBoardRow,
  type InstallmentFilter,
  PURCHASE_ORDER_REPOSITORY,
  type PurchaseOrderRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-order-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { toLocalDate } from "@/shared/domain/local-date";

export type PaymentBoardRow = InstallmentBoardRow & { proofUrl: string | null };

/**
 * The payments page (Compras > Pagamentos, contas a pagar): every
 * installment of the placed orders by due day, filtered and paged here,
 * and the page's cards. For the management and the approvers.
 */
@Injectable()
export class ListPurchasePaymentsUseCase {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY)
    private readonly orders: PurchaseOrderRepositoryPort,
    private readonly access: PurchasesAccessService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async list(
    actor: AuthenticatedUser,
    filter: InstallmentFilter,
    page: PageRequest,
  ): Promise<Paginated<PaymentBoardRow>> {
    const { condominiumId } = await this.access.orderAccess(actor, "money");
    const rows = await this.orders.installments(
      condominiumId,
      filter,
      page,
      this.today(),
    );
    return {
      ...rows,
      items: await Promise.all(
        rows.items.map(async (row) => ({
          ...row,
          proofUrl: row.proofKey
            ? await this.storage.signedReadUrl(row.proofKey)
            : null,
        })),
      ),
    };
  }

  async overview(actor: AuthenticatedUser): Promise<InstallmentBoardOverview> {
    const { condominiumId } = await this.access.orderAccess(actor, "money");
    const today = this.today();
    return this.orders.installmentOverview(
      condominiumId,
      today,
      `${today.slice(0, 8)}01`,
    );
  }

  private today() {
    return toLocalDate(this.clock.now(), this.clock.timeZone);
  }
}
