import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { BookingAccessService } from "@/modules/bookings/application/booking-access.service";
import { seriesCancelledNotice } from "@/modules/bookings/application/booking-notices";
import { FreedSlotNoticesService } from "@/modules/bookings/application/freed-slot-notices.service";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
} from "@/modules/bookings/application/ports/booking-repository.port";
import { BookingStatus, checkCancel } from "@/modules/bookings/domain/booking";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type SeriesCancellation = {
  /** Dates cancelled now. */
  cancelled: number;
  /** Dates kept: past the booker's deadline (only a manager cancels them). */
  kept: number;
};

// Cancels the dates of a weekly series that haven't ended. The booker only
// those still within their deadline; a manager all of them. Whoever waits
// for a freed slot is told; the booker gets one notice for the series.
@Injectable()
export class CancelBookingSeriesUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly access: BookingAccessService,
    private readonly freed: FreedSlotNoticesService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    seriesId: string,
  ): Promise<SeriesCancellation> {
    const manager = await this.access.canManage(actor);
    const now = this.clock.now();
    const dates = await this.bookings.activeInSeries(
      tenantOf(actor),
      seriesId,
      now,
    );
    // Someone else's series is "not found" for a resident.
    if (
      dates.length === 0 ||
      (!manager && dates.some((booking) => booking.userId !== actor.id))
    ) {
      throw AppException.from(APP_ERRORS.bookings.seriesNotFound, undefined);
    }

    const cancelled: string[] = [];
    for (const booking of dates) {
      if (checkCancel(booking, now, manager)) continue;
      await this.bookings.update(
        booking.id,
        {
          status: BookingStatus.CANCELLED,
          cancelledBy: actor.id,
          cancelledAt: now,
          reason: null,
        },
        await this.freed.for(booking),
      );
      cancelled.push(booking.id);
    }

    const owner = dates[0]!;
    if (cancelled.length > 0) {
      await this.outbox.enqueue([
        seriesCancelledNotice(
          owner.userId,
          { seriesId, spaceName: owner.spaceName, count: cancelled.length },
          owner.userId !== actor.id,
        ),
      ]);
      this.outbox.kick();
      await this.audit.stampMany({
        actorId: actor.id,
        entity: "booking",
        entityIds: cancelled,
      });
    }
    return {
      cancelled: cancelled.length,
      kept: dates.length - cancelled.length,
    };
  }
}
