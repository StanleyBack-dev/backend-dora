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
import { prepareDocument } from "@/shared/application/document-file";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  IMAGE_PROCESSOR,
  type ImageProcessorPort,
} from "@/shared/application/ports/image-processor.port";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

// The buyer sends the document of one person of a pending order whose
// ticket needs it (a discount by age the app can't confirm, or a student,
// PcD or teacher ticket): an ID, a student card, a report… Once nothing
// else is missing the order goes to review.
@Injectable()
export class SubmitAttendeeProofUseCase {
  private readonly logger = new Logger(SubmitAttendeeProofUseCase.name);

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
    orderId: string,
    attendeeId: string,
    file: string,
  ): Promise<EventOrder> {
    const order = await this.access.loadOwn(actor, orderId);
    const now = this.clock.now();
    if (
      order.status !== EventOrderStatus.PENDING_PAYMENT ||
      !order.expiresAt ||
      order.expiresAt <= now
    ) {
      throw AppException.from(APP_ERRORS.events.orderNotPending, undefined);
    }
    const attendee = order.attendees.find((person) => person.id === attendeeId);
    if (!attendee || !attendee.needsProof) {
      throw AppException.from(APP_ERRORS.events.proofNotNeeded, undefined);
    }
    const proof = await prepareDocument(this.images, file);
    if (!proof) {
      throw AppException.from(APP_ERRORS.events.invalidProof, undefined);
    }
    const key = `event-proofs/${order.condominiumId}/${order.id}/${randomUUID()}.${proof.extension}`;
    await this.storage.put(key, proof.data, proof.contentType);
    const sent = await this.orders.attachProof(
      order.id,
      attendeeId,
      { key, contentType: proof.contentType },
      now,
    );
    if (!sent) {
      await this.storage.deleteMany([key]).catch((error) => {
        this.logger.warn(`Proof not removed: ${String(error)}`);
      });
      throw AppException.from(APP_ERRORS.events.orderNotPending, undefined);
    }
    // A document sent again replaces the older one.
    if (attendee.proofKey) {
      await this.storage.deleteMany([attendee.proofKey]).catch(() => {});
    }
    return this.review.whenComplete(actor, sent, now);
  }
}
