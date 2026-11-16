import { randomUUID } from "crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { EventOrderAccessService } from "@/modules/events/application/event-order-access.service";
import { EventOrderReviewQueue } from "@/modules/events/application/event-order-review-queue.service";
import {
  EVENT_ORDER_REPOSITORY,
  type EventOrder,
  type EventOrderRepositoryPort,
} from "@/modules/events/application/ports/event-order-repository.port";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";
import { prepareDocument } from "@/shared/application/document-file";

// The buyer sends the PIX receipt of a pending order (within its 48 h): a
// PDF as sent, or an image re-encoded from its pixels (no metadata). Once
// nothing else is missing the order goes to review and the managers are
// told.
@Injectable()
export class SubmitOrderReceiptUseCase {
  private readonly logger = new Logger(SubmitOrderReceiptUseCase.name);

  constructor(
    @Inject(EVENT_ORDER_REPOSITORY)
    private readonly orders: EventOrderRepositoryPort,
    private readonly access: EventOrderAccessService,
    private readonly review: EventOrderReviewQueue,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessorPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    file: string,
  ): Promise<EventOrder> {
    const order = await this.access.loadOwn(actor, id);
    const now = this.clock.now();
    if (
      order.status !== EventOrderStatus.PENDING_PAYMENT ||
      !order.expiresAt ||
      order.expiresAt <= now
    ) {
      throw AppException.from(APP_ERRORS.events.orderNotPending, undefined);
    }

    const receipt = await prepareDocument(this.images, file);
    if (!receipt) {
      throw AppException.from(APP_ERRORS.events.invalidReceipt, undefined);
    }
    const key = `event-receipts/${order.condominiumId}/${order.id}/${randomUUID()}.${receipt.extension}`;
    await this.storage.put(key, receipt.data, receipt.contentType);

    const sent = await this.orders.attachReceipt(
      order.id,
      { key, contentType: receipt.contentType },
      now,
    );
    if (!sent) {
      await this.storage.deleteMany([key]).catch((error) => {
        this.logger.warn(`Receipt not removed: ${String(error)}`);
      });
      throw AppException.from(APP_ERRORS.events.orderNotPending, undefined);
    }
    // A receipt sent again replaces the older one.
    if (order.receiptKey) {
      await this.storage.deleteMany([order.receiptKey]).catch(() => {});
    }
    return this.review.whenComplete(actor, sent, now);
  }
}
