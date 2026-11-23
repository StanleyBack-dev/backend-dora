import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { Permission } from "@/modules/access-control/domain/permission";
import {
  PURCHASE_APPROVAL_REPOSITORY,
  type PurchaseApprovalRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-approval-repository.port";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  APPROVAL_LIMITS,
  ApprovalMode,
  type PurchaseSettings,
} from "@/modules/purchases/domain/purchase-approval";

// How the condominium approves its purchases: read by the management and
// the approvers; changed only by the approvers (whoever chooses the quotes
// can't raise the limit to skip the approval). Takes effect on the next
// choice: what already waits keeps waiting.
@Injectable()
export class PurchaseSettingsUseCase {
  constructor(
    @Inject(PURCHASE_APPROVAL_REPOSITORY)
    private readonly approvals: PurchaseApprovalRepositoryPort,
    private readonly access: PurchasesAccessService,
  ) {}

  async get(actor: AuthenticatedUser): Promise<PurchaseSettings> {
    const condominiumId = await this.access.condominiumWithAny(
      actor,
      Permission.PURCHASES_MANAGE,
      Permission.PURCHASES_APPROVE,
    );
    return this.approvals.settings(condominiumId);
  }

  async save(
    actor: AuthenticatedUser,
    mode: ApprovalMode,
    limitCents: number | null | undefined,
  ): Promise<PurchaseSettings> {
    const condominiumId = await this.access.condominiumOf(actor);
    let limit: number | null = null;
    if (mode === ApprovalMode.LIMIT) {
      if (
        limitCents === null ||
        limitCents === undefined ||
        !Number.isInteger(limitCents) ||
        limitCents < 1 ||
        limitCents > APPROVAL_LIMITS.maxLimitCents
      ) {
        throw AppException.from(APP_ERRORS.purchases.requestInvalid, {
          reason: "Informe o valor da alçada (a partir de R$ 0,01).",
        });
      }
      limit = limitCents;
    }
    // The table keeps who changed it last and when.
    return this.approvals.saveSettings(condominiumId, mode, limit, actor.id);
  }
}
