import type { GateEntry } from "@/modules/bookings/application/use-cases/list-gate-guests.use-case";
import type { BookingGuest } from "@/modules/bookings/domain/booking-guest";
import type { BookingGuestType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking-guest.output";
import type { GateGuestType } from "@/modules/bookings/presentation/graphql/dto/outputs/gate-guest.output";
import { checkInWindowOf } from "@/modules/bookings/presentation/graphql/guest-check-in-window";
import { unitLabel } from "@/modules/condominiums/domain/unit";

/** A guest on the booker's (or a manager's) list. */
export const toBookingGuestType = (guest: BookingGuest): BookingGuestType => ({
  id: guest.id,
  bookingId: guest.bookingId,
  name: guest.name,
  documentType: guest.documentType,
  document: guest.document,
  phone: guest.phone,
  code: guest.code,
  checkedInAt: guest.checkedInAt,
  createdAt: guest.createdAt,
});

/** A guest on the gate's list. */
export const toGateGuestType = (guest: GateEntry): GateGuestType => ({
  id: guest.id,
  bookingId: guest.bookingId,
  name: guest.name,
  documentType: guest.documentType,
  document: guest.document,
  phone: guest.phone,
  code: guest.code,
  checkedInAt: guest.checkedInAt,
  spaceName: guest.spaceName,
  startsAt: guest.startsAt,
  endsAt: guest.endsAt,
  hostName: guest.hostName,
  unitLabel:
    guest.unitNumber !== null
      ? unitLabel({
          street: guest.unitStreet,
          block: guest.unitBlock ?? "",
          number: guest.unitNumber,
        })
      : null,
  checkInWindow: checkInWindowOf(guest.checkInDenial),
});
