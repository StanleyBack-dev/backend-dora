import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { BookingAccessService } from "@/modules/bookings/application/booking-access.service";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  SPACE_BLOCK_REPOSITORY,
  type SpaceBlockRepositoryPort,
} from "@/modules/bookings/application/ports/space-block-repository.port";
import { feeForBooking } from "@/modules/bookings/domain/booking-fee";
import { checkSlot, limitRange } from "@/modules/bookings/domain/booking-slots";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import type { Space } from "@/modules/spaces/domain/space";
import { LimitPeriod } from "@/modules/spaces/domain/space-rules";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const PERIOD_WORDS: Record<LimitPeriod, string> = {
  [LimitPeriod.DAY]: "por dia",
  [LimitPeriod.WEEK]: "por semana",
  [LimitPeriod.MONTH]: "por mês",
};

/** Who is booking: a manager, and the unit the booking counts for. */
export type Booker = {
  condominiumId: string;
  manager: boolean;
  /** null: a manager booking for the condominium (no unit, no fee). */
  unitId: string | null;
};

/** One start that passed every rule, with what the booking keeps. */
export type BookingPlan = {
  startsAt: Date;
  endsAt: Date;
  cancelUntil: Date;
  feeCents: number | null;
};

// The rules every booking passes, single or weekly: a real slot of the
// space, ahead of time and inside the window, not blocked, and within the
// unit's limit. Failures are AppExceptions with the message for the person.
@Injectable()
export class BookingPolicyService {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(SPACE_BLOCK_REPOSITORY)
    private readonly blocks: SpaceBlockRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly access: BookingAccessService,
    private readonly users: UserLookupService,
  ) {}

  /**
   * Residents book for their unit; a manager without a unit books for the
   * condominium (no unit limit, no fee).
   */
  async booker(actor: AuthenticatedUser): Promise<Booker> {
    const condominiumId = tenantOf(actor);
    const manager = await this.access.canManage(actor);
    const unitId = await this.users.memberUnitId(actor.id, condominiumId);
    if (!unitId && !manager) {
      throw AppException.from(APP_ERRORS.bookings.unitRequired, undefined);
    }
    return { condominiumId, manager, unitId };
  }

  /**
   * Checks one start under the space's rules. `beyondWindow`: a manager's
   * weekly series may go past the calendar window (fixed classes, groups).
   */
  async plan(
    space: Space,
    startsAt: Date,
    booker: Booker,
    options: { beyondWindow?: boolean } = {},
  ): Promise<BookingPlan> {
    const rules = space.rules;
    const timeZone = this.clock.timeZone;
    const denial = checkSlot(startsAt, rules, this.clock.now(), timeZone);
    if (denial === "not-a-slot") {
      throw AppException.from(APP_ERRORS.bookings.notASlot, undefined);
    }
    if (denial === "past") {
      throw AppException.from(APP_ERRORS.bookings.past, undefined);
    }
    if (denial === "too-soon") {
      throw AppException.from(APP_ERRORS.bookings.tooSoon, {
        hours: rules.minAdvanceHours,
      });
    }
    if (denial === "too-far" && !options.beyondWindow) {
      throw AppException.from(APP_ERRORS.bookings.tooFar, {
        days: rules.maxAdvanceDays,
      });
    }
    const endsAt = new Date(startsAt.getTime() + rules.slotMinutes * 60_000);

    const [block] = await this.blocks.overlapping(space.id, startsAt, endsAt);
    if (block) {
      throw AppException.from(APP_ERRORS.bookings.blocked, {
        reason: block.reason,
      });
    }

    if (booker.unitId && rules.unitLimit) {
      const range = limitRange(startsAt, rules.unitLimit.period, timeZone);
      const used = await this.bookings.countUnitActive(
        space.id,
        booker.unitId,
        range.from,
        range.to,
      );
      if (used >= rules.unitLimit.count) {
        throw AppException.from(APP_ERRORS.bookings.unitLimit, {
          count: rules.unitLimit.count,
          period: PERIOD_WORDS[rules.unitLimit.period],
        });
      }
    }

    return {
      startsAt,
      endsAt,
      cancelUntil: new Date(
        startsAt.getTime() - rules.cancelUntilHours * 3_600_000,
      ),
      feeCents: feeForBooking(rules.feeCents, booker.unitId),
    };
  }
}
