import type { BookingView } from "@/modules/bookings/application/ports/booking-repository.port";
import type { SpaceBlockView } from "@/modules/bookings/application/ports/space-block-repository.port";
import type { BookingType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking.output";
import type { SpaceBlockType } from "@/modules/bookings/presentation/graphql/dto/outputs/space-block.output";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import type { SpaceKind } from "@/modules/spaces/domain/space";

/** A booking as the API returns it. */
export const toBookingType = (booking: BookingView): BookingType => ({
  id: booking.id,
  spaceId: booking.spaceId,
  spaceName: booking.spaceName,
  spaceKind: booking.spaceKind as SpaceKind,
  guestsAllowed: booking.guestsAllowed,
  userId: booking.userId,
  userName: booking.userName,
  unitLabel:
    booking.unitNumber !== null
      ? unitLabel({
          block: booking.unitBlock ?? "",
          number: booking.unitNumber,
        })
      : null,
  startsAt: booking.startsAt,
  endsAt: booking.endsAt,
  status: booking.status,
  notes: booking.notes,
  cancelUntil: booking.cancelUntil,
  reason: booking.reason,
  decidedAt: booking.decidedAt,
  cancelledAt: booking.cancelledAt,
  cancelledByManager:
    booking.cancelledBy !== null && booking.cancelledBy !== booking.userId,
  feeCents: booking.feeCents,
  feeBilledAt: booking.feeBilledAt,
  seriesId: booking.seriesId,
  createdAt: booking.createdAt,
});

export const toSpaceBlockType = (block: SpaceBlockView): SpaceBlockType => ({
  id: block.id,
  spaceId: block.spaceId,
  startsAt: block.startsAt,
  endsAt: block.endsAt,
  reason: block.reason,
  createdByName: block.createdByName,
  createdAt: block.createdAt,
});
