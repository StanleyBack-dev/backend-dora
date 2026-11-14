import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import {
  BOOKING_REPOSITORY,
  type BookingFilter,
  type BookingRepositoryPort,
  type BookingView,
} from "@/modules/bookings/application/ports/booking-repository.port";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

// Bookings of the session's condominium: the caller's own ("Minhas
// reservas") or every booking (managers, with filters).
@Injectable()
export class ListBookingsUseCase {
  constructor(
    @Inject(BOOKING_REPOSITORY)
    private readonly bookings: BookingRepositoryPort,
  ) {}

  mine(
    actor: AuthenticatedUser,
    when: "UPCOMING" | "PAST",
    page: PageRequest,
  ): Promise<Paginated<BookingView>> {
    return this.bookings.page(
      { condominiumId: tenantOf(actor), userId: actor.id, when },
      page,
    );
  }

  all(
    actor: AuthenticatedUser,
    filter: Omit<BookingFilter, "condominiumId" | "userId">,
    page: PageRequest,
  ): Promise<Paginated<BookingView>> {
    return this.bookings.page(
      { ...filter, condominiumId: tenantOf(actor) },
      page,
    );
  }
}
