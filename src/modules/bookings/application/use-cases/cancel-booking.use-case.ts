import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { BookingAccessService } from "@/modules/bookings/application/booking-access.service";
import { cancelledNotice } from "@/modules/bookings/application/booking-notices";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  BookingStatus,
  checkCancel,
  normalizeText,
  type CancelDenial,
} from "@/modules/bookings/domain/booking";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import { formatDateTime } from "@/shared/domain/local-date";

// The booker cancels their own booking until the deadline set when booking;
// a manager cancels any booking that has not ended (the booker is told).
@Injectable()
export class CancelBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly access: BookingAccessService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    id: string,
    reasonInput?: string | null,
  ): Promise<BookingView> {
    const manager = await this.access.canManage(actor);
    const booking = await this.bookings.find(tenantOf(actor), id);
    // Someone else's booking is "not found" for a resident.
    if (!booking || (!manager && booking.userId !== actor.id)) {
      throw AppException.from(APP_ERRORS.bookings.notFound, undefined);
    }
    const reason = normalizeText(reasonInput, 300);
    if (reason === "too-long") {
      throw AppException.from(APP_ERRORS.bookings.invalidText, {
        reason: "O motivo deve ter até 300 caracteres.",
      });
    }

    const now = this.clock.now();
    const denial = checkCancel(booking, now, manager);
    if (denial) {
      throw AppException.from(APP_ERRORS.bookings.cannotCancel, {
        reason: this.message(denial, booking),
      });
    }

    const byManager = booking.userId !== actor.id;
    const cancelled = await this.bookings.update(
      id,
      {
        status: BookingStatus.CANCELLED,
        cancelledBy: actor.id,
        cancelledAt: now,
        reason,
      },
      [
        cancelledNotice(
          booking.userId,
          booking,
          {
            byManager,
            reason,
            wasConfirmed: booking.status === BookingStatus.CONFIRMED,
          },
          this.clock.timeZone,
        ),
      ],
    );
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "booking",
      entityId: id,
    });
    return cancelled;
  }

  private message(denial: CancelDenial, booking: BookingView): string {
    if (denial === "not-active") return "Esta reserva já não está ativa.";
    if (denial === "finished") return "Esta reserva já terminou.";
    return `O prazo para cancelar esta reserva terminou em ${formatDateTime(booking.cancelUntil, this.clock.timeZone)}. Fale com a administração.`;
  }
}
