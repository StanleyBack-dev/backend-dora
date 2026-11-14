import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { confirmedNotice } from "@/modules/bookings/application/booking-notices";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import { BookingStatus } from "@/modules/bookings/domain/booking";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

// A manager approves a pending booking; the booker gets the confirmation
// with the calendar invite.
@Injectable()
export class ApproveBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async execute(actor: AuthenticatedUser, id: string): Promise<BookingView> {
    const booking = await this.bookings.find(tenantOf(actor), id);
    if (!booking) {
      throw AppException.from(APP_ERRORS.bookings.notFound, undefined);
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw AppException.from(APP_ERRORS.bookings.notPending, undefined);
    }
    const now = this.clock.now();
    if (booking.startsAt <= now) {
      throw AppException.from(APP_ERRORS.bookings.past, undefined);
    }
    const approved = await this.bookings.update(
      id,
      { status: BookingStatus.CONFIRMED, decidedBy: actor.id, decidedAt: now },
      [confirmedNotice(booking.userId, booking, this.clock.timeZone, true)],
    );
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "booking",
      entityId: id,
    });
    return approved;
  }
}
