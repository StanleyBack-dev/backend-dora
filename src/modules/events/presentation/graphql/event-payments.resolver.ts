import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { Permission } from "@/modules/access-control/domain/permission";
import { RequirePermissions } from "@/modules/access-control/presentation/decorators/require-permissions.decorator";
import { ListEventOrdersUseCase } from "@/modules/events/application/use-cases/list-event-orders.use-case";
import { ReviewEventOrderUseCase } from "@/modules/events/application/use-cases/review-event-order.use-case";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import { EventOrderType } from "@/modules/events/presentation/graphql/dto/outputs/event-order.output";
import { toOrderType } from "@/modules/events/presentation/graphql/event-order.mapper";
import "@/modules/events/presentation/graphql/events.graphql-enums";

// Whoever reviews payments: an event's orders and the receipt review.
@Resolver()
export class EventPaymentsResolver {
  constructor(
    private readonly listing: ListEventOrdersUseCase,
    private readonly reviewing: ReviewEventOrderUseCase,
  ) {}

  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @Query(() => [EventOrderType], {
    description: "Pedidos de um evento (opcionalmente de uma situação).",
  })
  async eventOrders(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, UuidArg()) eventId: string,
    @Args("status", { type: () => EventOrderStatus, nullable: true })
    status?: EventOrderStatus | null,
  ): Promise<EventOrderType[]> {
    return (await this.listing.execute(actor, eventId, status ?? null)).map(
      toOrderType,
    );
  }

  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @Mutation(() => EventOrderType, {
    description: "Aprova o comprovante: o pedido fica confirmado.",
  })
  async approveEventOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<EventOrderType> {
    return toOrderType(await this.reviewing.approve(actor, id));
  }

  @RequirePermissions(Permission.PAYMENTS_MANAGE)
  @Mutation(() => EventOrderType, {
    description: "Recusa o comprovante, com o motivo: as vagas voltam.",
  })
  async rejectEventOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("reason") reason: string,
  ): Promise<EventOrderType> {
    return toOrderType(await this.reviewing.reject(actor, id, reason));
  }
}
