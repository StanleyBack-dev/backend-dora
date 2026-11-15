import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { AddBookingGuestsUseCase } from "@/modules/bookings/application/use-cases/add-booking-guests.use-case";
import { ListBookingGuestsUseCase } from "@/modules/bookings/application/use-cases/list-booking-guests.use-case";
import { RemoveBookingGuestUseCase } from "@/modules/bookings/application/use-cases/remove-booking-guest.use-case";
import { AddBookingGuestsInput } from "@/modules/bookings/presentation/graphql/dto/inputs/add-booking-guests.input";
import { BookingGuestType } from "@/modules/bookings/presentation/graphql/dto/outputs/booking-guest.output";
import { toBookingGuestType } from "@/modules/bookings/presentation/graphql/guest.mapper";

// The guest list of a booking: the booker manages their own, a manager any
// (the use cases check both).
@Resolver()
export class BookingGuestsResolver {
  constructor(
    private readonly listing: ListBookingGuestsUseCase,
    private readonly adding: AddBookingGuestsUseCase,
    private readonly removing: RemoveBookingGuestUseCase,
  ) {}

  @Query(() => [BookingGuestType], {
    description: "Convidados de uma reserva (sua, ou qualquer para gestores).",
  })
  async bookingGuests(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("bookingId", { type: () => ID }, UuidArg()) bookingId: string,
  ): Promise<BookingGuestType[]> {
    return (await this.listing.execute(actor, bookingId)).map(
      toBookingGuestType,
    );
  }

  @Mutation(() => [BookingGuestType], {
    description:
      "Adiciona convidados à reserva; cada um recebe o código do convite.",
  })
  async addBookingGuests(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: AddBookingGuestsInput,
  ): Promise<BookingGuestType[]> {
    return (
      await this.adding.execute(actor, input.bookingId, input.guests)
    ).map(toBookingGuestType);
  }

  @Mutation(() => Boolean, {
    description: "Tira um convidado da lista (o convite deixa de valer).",
  })
  async removeBookingGuest(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<boolean> {
    await this.removing.execute(actor, id);
    return true;
  }
}
