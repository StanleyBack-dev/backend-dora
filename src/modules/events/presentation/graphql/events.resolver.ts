import { Args, ID, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { GetEventUseCase } from "@/modules/events/application/use-cases/get-event.use-case";
import { ListEventsUseCase } from "@/modules/events/application/use-cases/list-events.use-case";
import { EventType } from "@/modules/events/presentation/graphql/dto/outputs/event.output";
import { toEventType } from "@/modules/events/presentation/graphql/event.mapper";
import { EventWhen } from "@/modules/events/presentation/graphql/events.graphql-enums";

// What every member of a condominium with the module sees.
@Resolver()
export class EventsResolver {
  constructor(
    private readonly listing: ListEventsUseCase,
    private readonly getting: GetEventUseCase,
  ) {}

  @Query(() => [EventType], {
    description:
      "Eventos do condomínio: próximos ou passados (gestores também veem os rascunhos).",
  })
  async events(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("when", { type: () => EventWhen, nullable: true })
    when?: EventWhen | null,
  ): Promise<EventType[]> {
    const events = await this.listing.execute(
      actor,
      when === EventWhen.PAST ? "past" : "upcoming",
    );
    return events.map(toEventType);
  }

  @Query(() => EventType)
  async event(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<EventType> {
    return toEventType(await this.getting.execute(actor, id));
  }
}
