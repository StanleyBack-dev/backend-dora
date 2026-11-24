import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { Permission } from "@/modules/access-control/domain/permission";
import {
  type ApprovalOverview,
  PURCHASE_APPROVAL_REPOSITORY,
  type PurchaseApprovalRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import type { PurchaseRequestFilter } from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  ListQuoteBoardUseCase,
  type QuoteBoardRow,
} from "@/modules/purchases/application/use-cases/list-quote-board.use-case";
import type { PurchaseApproval } from "@/modules/purchases/domain/purchase-approval";
import { PurchaseRequestStatus } from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import { startOfLocalDate, toLocalDate } from "@/shared/domain/local-date";

/** The stages the approvals page shows. */
export const APPROVAL_BOARD_STATUSES: readonly PurchaseRequestStatus[] = [
  PurchaseRequestStatus.AWAITING_APPROVAL,
  PurchaseRequestStatus.APPROVED,
  PurchaseRequestStatus.ORDERED,
  PurchaseRequestStatus.RECEIVED,
  PurchaseRequestStatus.COMPLETED,
  PurchaseRequestStatus.REJECTED,
];

/**
 * The approvals page (Compras > Aprovações, the approvers): the requests
 * waiting for approval, approved or rejected, as on the quotes page; the
 * page's cards; and a request's decisions (read by the management too).
 */
@Injectable()
export class ListPurchaseApprovalsUseCase {
  constructor(
    private readonly board: ListQuoteBoardUseCase,
    @Inject(PURCHASE_APPROVAL_REPOSITORY)
    private readonly approvals: PurchaseApprovalRepositoryPort,
    private readonly access: PurchasesAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async list(
    actor: AuthenticatedUser,
    filter: PurchaseRequestFilter,
    page: PageRequest,
  ): Promise<Paginated<QuoteBoardRow>> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.board.rows(
      condominiumId,
      filter,
      page,
      APPROVAL_BOARD_STATUSES,
    );
  }

  async overview(actor: AuthenticatedUser): Promise<ApprovalOverview> {
    const condominiumId = await this.access.condominiumOf(actor);
    const today = toLocalDate(this.clock.now(), this.clock.timeZone);
    const monthStart = startOfLocalDate(
      `${today.slice(0, 8)}01`,
      this.clock.timeZone,
    );
    return this.approvals.overview(condominiumId, monthStart);
  }

  /** A request's decisions, the latest first. */
  async history(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<PurchaseApproval[]> {
    await this.access.condominiumWithAny(
      actor,
      Permission.PURCHASES_MANAGE,
      Permission.PURCHASES_APPROVE,
    );
    const request = await this.access.loadRequest(actor, requestId);
    return this.approvals.history(request.id);
  }
}
