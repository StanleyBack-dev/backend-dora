import { Inject, Injectable } from "@nestjs/common";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import {
  BOOKING_GUEST_REPOSITORY,
  type BookingGuestRepositoryPort,
} from "@/modules/bookings/application/ports/booking-guest-repository.port";
import { isActive } from "@/modules/bookings/domain/booking";
import {
  firstName,
  inviteStatus,
  normalizeGuestCode,
  type GuestInviteStatus,
} from "@/modules/bookings/domain/booking-guest";
import {
  SECRETS,
  type SecretsPort,
} from "@/modules/identity/application/ports/secrets.port";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";
import {
  RATE_LIMIT,
  type RateLimitPort,
} from "@/shared/application/ports/rate-limit.port";
import { rateStatus, type RateRule } from "@/shared/domain/rate-limit";

/** Invites opened per connection (guessing codes stays impractical). */
export const INVITE_LIMIT: RateRule = { limit: 60, windowMs: 10 * 60_000 };

/** What the guest sees: nothing about the host beyond the first name. */
export type GuestInvite = {
  code: string;
  guestName: string;
  hostFirstName: string;
  spaceName: string;
  condominiumName: string;
  startsAt: Date;
  endsAt: Date;
  status: GuestInviteStatus;
  checkedIn: boolean;
};

// The public page of a guest's invite (the link shared by WhatsApp). The
// code is the key: 8 characters from 31 symbols, and each connection opens
// at most 60 invites per 10 minutes.
@Injectable()
export class GetGuestInviteUseCase {
  constructor(
    @Inject(BOOKING_GUEST_REPOSITORY)
    private readonly guests: BookingGuestRepositoryPort,
    @Inject(RATE_LIMIT) private readonly limits: RateLimitPort,
    @Inject(SECRETS) private readonly secrets: SecretsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(
    rawCode: string,
    ip: string | null,
  ): Promise<GuestInvite | null> {
    const window = await this.limits.hit(
      `guest-invite:${this.secrets.digest(ip ?? "unknown")}`,
      INVITE_LIMIT.windowMs,
    );
    const status = rateStatus(
      { ...window, count: window.count - 1 },
      INVITE_LIMIT,
      this.clock.now(),
    );
    if (status.blocked) {
      throw AppException.from(APP_ERRORS.identity.tooManyRequests, {
        minutes: status.retryAfterMinutes,
      });
    }

    const code = normalizeGuestCode(rawCode);
    const guest = code ? await this.guests.findByCode(code) : null;
    if (!guest) return null;
    return {
      code: guest.code,
      guestName: guest.name,
      hostFirstName: firstName(guest.hostName),
      spaceName: guest.spaceName,
      condominiumName: guest.condominiumName,
      startsAt: guest.startsAt,
      endsAt: guest.endsAt,
      status: inviteStatus(
        { endsAt: guest.endsAt, active: isActive(guest.bookingStatus) },
        this.clock.now(),
      ),
      checkedIn: guest.checkedInAt !== null,
    };
  }
}
