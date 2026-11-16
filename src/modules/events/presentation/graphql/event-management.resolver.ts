import { Args, ID, Mutation, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { CancelEventUseCase } from "@/modules/events/application/use-cases/cancel-event.use-case";
import { CreateEventUseCase } from "@/modules/events/application/use-cases/create-event.use-case";
import { PublishEventUseCase } from "@/modules/events/application/use-cases/publish-event.use-case";
import { UpdateEventUseCase } from "@/modules/events/application/use-cases/update-event.use-case";
import { EventInput } from "@/modules/events/presentation/graphql/dto/inputs/event.input";
import { EventType } from "@/modules/events/presentation/graphql/dto/outputs/event.output";
import { toEventType } from "@/modules/events/presentation/graphql/event.mapper";

// Managers (and the platform) create, edit, publish and cancel events.
@Resolver()
export class EventManagementResolver {
  constructor(
    private readonly creating: CreateEventUseCase,
    private readonly updating: UpdateEventUseCase,
    private readonly publishing: PublishEventUseCase,
    private readonly cancelling: CancelEventUseCase,
  ) {}

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => EventType, { description: "Cria o evento como rascunho." })
  async createEvent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("input") input: EventInput,
  ): Promise<EventType> {
    return toEventType(await this.creating.execute(actor, input));
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => EventType, {
    description: "Edita um evento que ainda não terminou nem foi cancelado.",
  })
  async updateEvent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("input") input: EventInput,
  ): Promise<EventType> {
    return toEventType(await this.updating.execute(actor, id, input));
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => EventType, {
    description: "Publica o rascunho: os moradores são avisados.",
  })
  async publishEvent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<EventType> {
    return toEventType(await this.publishing.execute(actor, id));
  }

  @RequirePermissions(Permission.EVENTS_MANAGE)
  @Mutation(() => EventType, {
    description:
      "Cancela o evento com o motivo; se estava publicado, os moradores são avisados.",
  })
  async cancelEvent(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<EventType> {
    return toEventType(await this.cancelling.execute(actor, id, reason));
  }
}
