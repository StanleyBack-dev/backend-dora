import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import {
  seriesApprovalNotice,
  seriesCreatedNotice,
} from "@/modules/bookings/application/booking-notices";
import { BookingPolicyService } from "@/modules/bookings/application/booking-policy.service";
import {
  BOOKING_REPOSITORY,
  SlotTakenError,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  WAITLIST_REPOSITORY,
  type WaitlistRepositoryPort,
} from "@/modules/bookings/application/ports/waitlist-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import { bookingNotes } from "@/modules/bookings/application/use-cases/create-booking.use-case";
import { BookingStatus } from "@/modules/bookings/domain/booking";
import {
  isSeriesLength,
  weeklyStarts,
} from "@/modules/bookings/domain/booking-series";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

export type CreateBookingSeriesInput = {
  spaceId: string;
  /** The first booking; the others follow weekly at the same time. */
  startsAt: Date;
  weeks: number;
  notes?: string | null;
};

export type SkippedDate = { startsAt: Date; reason: string };

export type BookingSeriesResult = {
  seriesId: string;
  created: BookingView[];
  skipped: SkippedDate[];
};

// A weekly booking: the same slot for 2 to 26 weeks. Each date passes the
// same rules as a single booking; dates that can't be booked (taken,
// blocked, beyond the window, over the unit limit) are skipped and
// reported, but the first date must work. Residents only where the space
// allows it; managers may go past the calendar window (fixed classes).
@Injectable()
export class CreateBookingSeriesUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(WAITLIST_REPOSITORY)
    private readonly waitlist: WaitlistRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly spaces: SpaceForBooking,
    private readonly policy: BookingPolicyService,
    private readonly users: UserLookupService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateBookingSeriesInput,
  ): Promise<BookingSeriesResult> {
    if (!isSeriesLength(input.weeks)) {
      throw AppException.from(APP_ERRORS.bookings.invalidSeries, undefined);
    }
    const space = await this.spaces.load(actor, input.spaceId);
    const booker = await this.policy.booker(actor);
    if (!booker.manager && !space.rules.recurringAllowed) {
      throw AppException.from(
        APP_ERRORS.bookings.recurringNotAllowed,
        undefined,
      );
    }
    const notes = bookingNotes(input.notes);
    const timeZone = this.clock.timeZone;
    const needsApproval = space.rules.requiresApproval && !booker.manager;
    const seriesId = randomUUID();
    const options = { beyondWindow: booker.manager };

    // The first date must pass; it says whether the series makes sense.
    const [first, ...rest] = weeklyStarts(
      input.startsAt,
      input.weeks,
      timeZone,
    );
    await this.policy.plan(space, first!, booker, options);

    const created: BookingView[] = [];
    const skipped: SkippedDate[] = [];
    for (const startsAt of [first!, ...rest]) {
      try {
        const plan = await this.policy.plan(space, startsAt, booker, options);
        created.push(
          await this.bookings.create(
            {
              condominiumId: booker.condominiumId,
              spaceId: space.id,
              userId: actor.id,
              unitId: booker.unitId,
              startsAt: plan.startsAt,
              endsAt: plan.endsAt,
              status: needsApproval
                ? BookingStatus.PENDING
                : BookingStatus.CONFIRMED,
              notes,
              cancelUntil: plan.cancelUntil,
              feeCents: plan.feeCents,
              seriesId,
            },
            // One notice for the whole series, below.
            () => [],
          ),
        );
        await this.waitlist.leave(space.id, startsAt, actor.id);
      } catch (error) {
        if (error instanceof SlotTakenError) {
          skipped.push({ startsAt, reason: "Horário já reservado." });
        } else if (error instanceof AppException) {
          skipped.push({ startsAt, reason: error.message });
        } else {
          throw error;
        }
      }
    }
    if (created.length === 0) {
      // Taken between the check and the booking: the first date failed.
      throw AppException.from(APP_ERRORS.bookings.slotTaken, undefined);
    }

    const info = {
      seriesId,
      spaceName: space.name,
      first: created[0]!.startsAt,
      last: created[created.length - 1]!.startsAt,
      count: created.length,
      skipped: skipped.length,
    };
    const reviewers = needsApproval
      ? (
          await this.users.activeMemberIds(
            booker.condominiumId,
            UserGroup.ADMIN,
          )
        ).filter((id) => id !== actor.id)
      : [];
    await this.outbox.enqueue([
      seriesCreatedNotice(actor.id, info, needsApproval, timeZone),
      ...reviewers.map((managerId) =>
        seriesApprovalNotice(managerId, info, actor.name, timeZone),
      ),
    ]);
    this.outbox.kick();
    await this.audit.stampMany({
      actorId: actor.id,
      entity: "booking",
      entityIds: created.map((booking) => booking.id),
      created: true,
    });
    return { seriesId, created, skipped };
  }
}
