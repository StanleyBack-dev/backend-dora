import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { CheckInEventTicketUseCase } from "@/modules/events/application/use-cases/check-in-event-ticket.use-case";
import { ListEventTicketsUseCase } from "@/modules/events/application/use-cases/list-event-tickets.use-case";
import { ListGateEventTicketsUseCase } from "@/modules/events/application/use-cases/list-gate-event-tickets.use-case";
import { CheckInEventTicketInput } from "@/modules/events/presentation/graphql/dto/inputs/check-in-event-ticket.input";
import { GateEventTicketType } from "@/modules/events/presentation/graphql/dto/outputs/gate-event-ticket.output";
import { toGateTicketType } from "@/modules/events/presentation/graphql/gate-ticket.mapper";

// Event tickets: the gate's (Portaria) day list and entry, with the same
// permission as the booking guests' gate, and each event's list for its
// managers.
@Resolver()
export class EventGateResolver {
  constructor(
    private readonly listing: ListGateEventTicketsUseCase,
    private readonly checkingIn: CheckInEventTicketUseCase,
    private readonly ticketsOfEvent: ListEventTicketsUseCase,
  ) {}

  @RequirePermissions(Permission.GUESTS_CHECKIN)
  @Query(() => [GateEventTicketType], {
    description: "Ingressos dos eventos de um dia (padrão: hoje).",
  })
  async gateEventTickets(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("date", {
      type: () => String,
      nullable: true,
      description: "YYYY-MM-DD.",
    })
    date: string | null,
  ): Promise<GateEventTicketType[]> {
    return (await this.listing.execute(actor, date?.slice(0, 10))).map(
      toGateTicketType,
    );
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Query(() => [GateEventTicketType], {
    description:
      "Os ingressos de um evento (pedidos confirmados) e quem já entrou.",
  })
  async eventTickets(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, UuidArg()) eventId: string,
  ): Promise<GateEventTicketType[]> {
    return (await this.ticketsOfEvent.execute(actor, eventId)).map(
      toGateTicketType,
    );
  }

  @RequirePermissions(Permission.GUESTS_CHECKIN)
  @Mutation(() => GateEventTicketType, {
    description: "Libera a entrada de um ingresso (pelo código ou da lista).",
  })
  async checkInEventTicket(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: CheckInEventTicketInput,
  ): Promise<GateEventTicketType> {
    return toGateTicketType(await this.checkingIn.execute(actor, input));
  }

  @RequirePermissions(Permission.GUESTS_CHECKIN)
  @Mutation(() => GateEventTicketType, {
    description: "Desfaz a entrada de um ingresso marcada por engano.",
  })
  async undoEventTicketCheckIn(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("attendeeId", { type: () => ID }, UuidArg()) attendeeId: string,
  ): Promise<GateEventTicketType> {
    return toGateTicketType(
      await this.checkingIn.execute(actor, { attendeeId }, true),
    );
  }
}
