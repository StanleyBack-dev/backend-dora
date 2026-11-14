import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { AuditTrailService } from "@/modules/audit/application/audit-trail.service";
import { cancelledNotice } from "@/modules/bookings/application/booking-notices";
import {
  BOOKING_REPOSITORY,
  type BookingRepositoryPort,
} from "@/modules/bookings/application/ports/booking-repository.port";
import {
  SPACE_BLOCK_REPOSITORY,
  type SpaceBlockRepositoryPort,
} from "@/modules/bookings/application/ports/space-block-repository.port";
import { SpaceForBooking } from "@/modules/bookings/application/space-for-booking";
import { BookingStatus } from "@/modules/bookings/domain/booking";
import {
  checkBlock,
  type BlockViolation,
  type SpaceBlock,
} from "@/modules/bookings/domain/space-block";
import { OutboxDispatcher } from "@/modules/outbox/application/outbox-dispatcher.service";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const VIOLATIONS: Record<BlockViolation, string> = {
  range: "O fim do bloqueio deve ser depois do início.",
  past: "Este período já passou.",
  "too-long":
    "Um bloqueio vai até 1 ano. Para uma pausa maior, desative o espaço.",
  reason: "Informe o motivo do bloqueio (3 a 200 caracteres).",
};

export type CreateSpaceBlockInput = {
  spaceId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  /** Cancel the active bookings in the period (each booker is told). */
  cancelOverlapping: boolean;
};

// Blocks a space for a period (maintenance, an event of the condominium).
// Active bookings in the period are only cancelled when the manager
// confirms it; otherwise the API answers how many there are.
@Injectable()
export class CreateSpaceBlockUseCase {
  constructor(
    @Inject(SPACE_BLOCK_REPOSITORY)
    private readonly blocks: SpaceBlockRepositoryPort,
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly spaces: SpaceForBooking,
    private readonly audit: AuditTrailService,
    private readonly outbox: OutboxDispatcher,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    input: CreateSpaceBlockInput,
  ): Promise<SpaceBlock> {
    const space = await this.spaces.load(actor, input.spaceId, true);
    const now = this.clock.now();
    const checked = checkBlock(input, now);
    if (typeof checked === "string") {
      throw AppException.from(APP_ERRORS.bookings.blockInvalid, {
        reason: VIOLATIONS[checked],
      });
    }

    const affected = (
      await this.bookings.activeInRange(space.id, input.startsAt, input.endsAt)
    ).filter((booking) => booking.endsAt > now);
    if (affected.length > 0 && !input.cancelOverlapping) {
      throw AppException.from(APP_ERRORS.bookings.blockOverlaps, {
        count: affected.length,
      });
    }

    const block = await this.blocks.create({
      condominiumId: tenantOf(actor),
      spaceId: space.id,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: checked.reason,
    });
    await this.audit.stamp({
      actorId: actor.id,
      entity: "space_block",
      entityId: block.id,
      created: true,
    });

    const reason = `Espaço bloqueado: ${checked.reason}`;
    for (const booking of affected) {
      await this.bookings.update(
        booking.id,
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
              byManager: true,
              reason,
              wasConfirmed: booking.status === BookingStatus.CONFIRMED,
            },
            this.clock.timeZone,
          ),
        ],
      );
    }
    if (affected.length > 0) this.outbox.kick();
    return block;
  }
}
