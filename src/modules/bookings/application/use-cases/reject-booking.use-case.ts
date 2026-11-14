import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { rejectedNotice } from "@/modules/bookings/application/booking-notices";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  BookingStatus,
  normalizeText,
} from "@/modules/bookings/domain/booking";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// A manager rejects a pending booking, always with a reason the booker reads.
// The slot is freed for others.
@Injectable()
export class RejectBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    reasonInput: string,
  ): Promise<BookingView> {
    const reason = normalizeText(reasonInput, 300);
    if (reason === null || reason === "too-long" || reason.length < 3) {
      throw AppException.from(APP_ERRORS.bookings.invalidText, {
        reason: "Informe o motivo da recusa (3 a 300 caracteres).",
      });
    }
    const booking = await this.bookings.find(tenantOf(actor), id);
    if (!booking) {
      throw AppException.from(APP_ERRORS.bookings.notFound, undefined);
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw AppException.from(APP_ERRORS.bookings.notPending, undefined);
    }
    const rejected = await this.bookings.update(
      id,
      {
        status: BookingStatus.REJECTED,
        decidedBy: actor.id,
        decidedAt: this.clock.now(),
        reason,
      },
      [rejectedNotice(booking.userId, booking, reason, this.clock.timeZone)],
    );
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "booking",
      entityId: id,
    });
    return rejected;
  }
}
