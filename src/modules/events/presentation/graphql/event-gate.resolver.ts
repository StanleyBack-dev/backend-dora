import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { PageInput } from "@/common/graphql/pagination.graphql";
import { GetEventTicketOverviewUseCase } from "@/modules/events/application/use-cases/get-event-ticket-overview.use-case";
import { EventTicketOverviewType } from "@/modules/events/presentation/graphql/dto/outputs/event-ticket-overview.output";
import { GateEventTicketPage } from "@/modules/events/presentation/graphql/dto/outputs/gate-event-ticket-page.output";
import type { Paginated } from "@/shared/application/pagination";
import { CheckInEventTicketUseCase } from "@/modules/events/application/use-cases/check-in-event-ticket.use-case";
import { ListEventTicketsUseCase } from "@/modules/events/application/use-cases/list-event-tickets.use-case";
import { ListGateEventTicketsUseCase } from "@/modules/events/application/use-cases/list-gate-event-tickets.use-case";
import { CheckInEventTicketInput } from "@/modules/events/presentation/graphql/dto/inputs/check-in-event-ticket.input";
import { EventTicketFilterInput } from "@/modules/events/presentation/graphql/dto/inputs/event-ticket-filter.input";
import { GateEventTicketType } from "@/modules/events/presentation/graphql/dto/outputs/gate-event-ticket.output";
import { toGateTicketType } from "@/modules/events/presentation/graphql/gate-ticket.mapper";

// Event tickets: the gate's (Portaria) day list and entry, with the same
// permission as the booking guests' gate, and each event's list for its
// managers.
const DEFAULT_PAGE = { page: 1, limit: 20 };

@Resolver()
export class EventGateResolver {
  constructor(
    private readonly listing: ListGateEventTicketsUseCase,
    private readonly checkingIn: CheckInEventTicketUseCase,
    private readonly ticketsOfEvent: ListEventTicketsUseCase,
    private readonly ticketOverview: GetEventTicketOverviewUseCase,
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
  @Query(() => GateEventTicketPage, {
    description:
      "Os ingressos de um evento (pedidos confirmados) e quem já entrou, com filtros, por página.",
  })
  async eventTickets(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, UuidArg()) eventId: string,
    @Args("filter", { type: () => EventTicketFilterInput, nullable: true })
    filter?: EventTicketFilterInput | null,
    @Args("page", { nullable: true }) page?: PageInput,
  ): Promise<Paginated<GateEventTicketType>> {
    const result = await this.ticketsOfEvent.execute(
      actor,
      eventId,
      {
        attendeeId: filter?.attendeeId ?? null,
        unitId: filter?.unitId ?? null,
        code: filter?.code?.trim() || null,
        checkedIn: filter?.checkedIn ?? null,
        ticketName: filter?.ticketName?.trim() || null,
        outside: filter?.outside ?? null,
        buyer: filter?.buyer ?? null,
      },
      page ?? DEFAULT_PAGE,
    );
    return { ...result, items: result.items.map(toGateTicketType) };
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Query(() => EventTicketOverviewType, {
    description:
      "Os números dos ingressos de um evento e as opções dos filtros (pessoas, unidades).",
  })
  eventTicketOverview(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, UuidArg()) eventId: string,
  ): Promise<EventTicketOverviewType> {
    return this.ticketOverview.execute(actor, eventId);
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
