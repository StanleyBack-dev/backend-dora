import { randomInt } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { GuestBookingService } from "@/modules/bookings/application/guest-booking.service";
import {
  BOOKING_GUEST_REPOSITORY,
  GuestCodeTakenError,
  type BookingGuestRepositoryPort,
  type NewGuest,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import {
  guestCode,
  MAX_GUESTS_PER_REQUEST,
  normalizeGuest,
  type BookingGuest,
  type GuestInput,
  type GuestViolation,
} from "@/modules/bookings/domain/booking-guest";

const MESSAGES: Record<GuestViolation, string> = {
  name: "Informe o nome de cada convidado (2 a 120 caracteres).",
  "document-type": "Escolha se o documento é CPF ou RG.",
  cpf: "CPF inválido. Confira os 11 números.",
  rg: "RG inválido. Use de 7 a 10 caracteres: números e, no fim, um X se houver.",
  "document-required":
    "Este espaço exige o documento (CPF ou RG) de cada convidado.",
  phone: "Telefone inválido. Informe o DDD e o número.",
};

/** A new code on the rare collision, a few times. */
const CODE_ATTEMPTS = 3;

// Adds guests to a booking under the space's rules: guests allowed, the
// space's limit (or its capacity, counting the booker), the document when
// required. Each guest gets the code of their invite.
@Injectable()
export class AddBookingGuestsUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    private readonly bookings: GuestBookingService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    bookingId: string,
    input: GuestInput[],
  ): Promise<BookingGuest[]> {
    const { booking, space } = await this.bookings.load(actor, bookingId, {
      toChange: true,
    });
    const rules = space.rules.guests;
    if (!rules.allowed) {
      throw AppException.from(APP_ERRORS.bookings.guestsNotAllowed, undefined);
    }
    if (input.length === 0) return [];
    if (input.length > MAX_GUESTS_PER_REQUEST) {
      throw AppException.from(APP_ERRORS.bookings.tooManyGuests, {
        max: MAX_GUESTS_PER_REQUEST,
      });
    }

    const data = input.map((guest) => {
      const result = normalizeGuest(guest, rules.documentRequired);
      if (typeof result === "string") {
        throw AppException.from(APP_ERRORS.bookings.invalidGuest, {
          reason: MESSAGES[result],
        });
      }
      return result;
    });

    // The space's limit; without one, its capacity (the booker included).
    const max =
      rules.max ?? (space.capacity !== null ? space.capacity - 1 : null);
    if (max !== null) {
      const already = await this.guests.countForBooking(booking.id);
      if (already + data.length > max) {
        throw AppException.from(APP_ERRORS.bookings.tooManyGuests, {
          max: Math.max(0, max),
        });
      }
    }

    for (let attempt = 1; ; attempt += 1) {
      const guests: NewGuest[] = data.map((guest) => ({
        ...guest,
        code: guestCode(randomInt),
      }));
      try {
        return await this.guests.add(booking, guests, actor.id);
      } catch (error) {
        if (
          !(error instanceof GuestCodeTakenError) ||
          attempt >= CODE_ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}
