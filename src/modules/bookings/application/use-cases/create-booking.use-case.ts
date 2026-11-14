import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { BookingAccessService } from "@/modules/bookings/application/booking-access.service";
import {
  approvalNeededNotice,
  confirmedNotice,
  requestedNotice,
} from "@/modules/bookings/application/booking-notices";
import {
  BOOKING_REPOSITORY,
  SlotTakenError,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  SPACE_BLOCK_REPOSITORY,
  type SpaceBlockRepositoryPort,
} from "@/modules/bookings/application/ports/space-block-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import {
  BookingStatus,
  normalizeText,
} from "@/modules/bookings/domain/booking";
import { checkSlot, limitRange } from "@/modules/bookings/domain/booking-slots";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { LimitPeriod } from "@/modules/spaces/domain/space-rules";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const PERIOD_WORDS: Record<LimitPeriod, string> = {
  [LimitPeriod.DAY]: "por dia",
  [LimitPeriod.WEEK]: "por semana",
  [LimitPeriod.MONTH]: "por mês",
};

export type CreateBookingInput = {
  spaceId: string;
  startsAt: Date;
  notes?: string | null;
};

// Books one slot of a space under its rules. The database refuses an
// overlapping active booking, so two people clicking together can't both
// get the slot.
@Injectable()
export class CreateBookingUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(SPACE_BLOCK_REPOSITORY)
    private readonly blocks: SpaceBlockRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly spaces: SpaceForBooking,
    private readonly access: BookingAccessService,
    private readonly users: UserLookupService,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateBookingInput,
  ): Promise<BookingView> {
    const condominiumId = tenantOf(actor);
    const space = await this.spaces.load(actor, input.spaceId);
    const rules = space.rules;
    const now = this.clock.now();
    const timeZone = this.clock.timeZone;

    const notes = normalizeText(input.notes, 300);
    if (notes === "too-long") {
      throw AppException.from(APP_ERRORS.bookings.invalidText, {
        reason: "A observação deve ter até 300 caracteres.",
      });
    }

    const startsAt = input.startsAt;
    const denial = checkSlot(startsAt, rules, now, timeZone);
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
    if (denial === "too-far") {
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

    // Residents book for their unit; a manager without a unit books for the
    // condominium (no unit limit).
    const manager = await this.access.canManage(actor);
    const unitId = await this.users.memberUnitId(actor.id, condominiumId);
    if (!unitId && !manager) {
      throw AppException.from(APP_ERRORS.bookings.unitRequired, undefined);
    }
    if (unitId && rules.unitLimit) {
      const range = limitRange(startsAt, rules.unitLimit.period, timeZone);
      const used = await this.bookings.countUnitActive(
        space.id,
        unitId,
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

    const needsApproval = rules.requiresApproval && !manager;
    const reviewers = needsApproval
      ? (
          await this.users.activeMemberIds(condominiumId, UserGroup.ADMIN)
        ).filter((id) => id !== actor.id)
      : [];

    let created: BookingView;
    try {
      created = await this.bookings.create(
        {
          condominiumId,
          spaceId: space.id,
          userId: actor.id,
          unitId,
          startsAt,
          endsAt,
          status: needsApproval
            ? BookingStatus.PENDING
            : BookingStatus.CONFIRMED,
          notes,
          cancelUntil: new Date(
            startsAt.getTime() - rules.cancelUntilHours * 3_600_000,
          ),
        },
        (booking) => {
          const info = { ...booking, spaceName: space.name };
          return needsApproval
            ? [
                requestedNotice(actor.id, info, timeZone),
                ...reviewers.map((managerId) =>
                  approvalNeededNotice(managerId, info, actor.name, timeZone),
                ),
              ]
            : [confirmedNotice(actor.id, info, timeZone, false)];
        },
      );
    } catch (error) {
      if (error instanceof SlotTakenError) {
        throw AppException.from(APP_ERRORS.bookings.slotTaken, undefined);
      }
      throw error;
    }
    this.outbox.kick();
    await this.audit.stamp({
      actorId: actor.id,
      entity: "booking",
      entityId: created.id,
      created: true,
    });
    return created;
  }
}
