import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { validateCancelReason } from "@/modules/purchases/application/purchase-request-input";
import { requestCancelledNotices } from "@/modules/purchases/application/purchase-request-notices";
import { PurchasesAccessService } from "@/modules/purchases/application/purchases-access.service";
import {
  isEditableRequest,
  type PurchaseRequest,
} from "@/modules/purchases/domain/purchase-request";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

/**
 * Whoever made the request, or the management, cancels it with a reason
 * while it still waits for quotes; when it was someone else, the requester
 * is told why.
 */
@Injectable()
export class CancelPurchaseRequestUseCase {
  constructor(
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
    private readonly access: PurchasesAccessService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    reasonInput: string,
  ): Promise<PurchaseRequest> {
    const current = await this.access.loadRequest(actor, id);
    const reason = validateCancelReason(reasonInput);
    if (!isEditableRequest(current.status)) {
      throw AppException.from(APP_ERRORS.purchases.requestLocked, undefined);
    }
    const cancelled = await this.requests.cancel(
      id,
      actor.id,
      reason,
      this.clock.now(),
      requestCancelledNotices(current, actor, reason),
    );
    if (!cancelled) {
      throw AppException.from(APP_ERRORS.purchases.requestLocked, undefined);
    }
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "purchase_request",
      entityId: id,
    });
    return cancelled;
  }
}
