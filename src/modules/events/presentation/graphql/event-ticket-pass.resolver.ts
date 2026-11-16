import { Args, Query, Resolver } from "@nestjs/graphql";
import { Public } from "@/common/decorators/public.decorator";
import {
  CurrentRequestMeta,
  type RequestMeta,
} from "@/common/decorators/request-meta.decorator";
import {
  GetEventTicketPassUseCase,
  type EventTicketPass,
} from "@/modules/events/application/use-cases/get-event-ticket-pass.use-case";
import { EventTicketPassType } from "@/modules/events/presentation/graphql/dto/outputs/event-ticket-pass.output";

// The public page of a ticket (the link shared with a guest by WhatsApp).
@Resolver()
export class EventTicketPassResolver {
  constructor(private readonly passes: GetEventTicketPassUseCase) {}

  @Public()
  @Query(() => EventTicketPassType, {
    nullable: true,
    description:
      "Ingresso pelo código (null: não existe ou o pedido não está confirmado).",
  })
  eventTicket(
    @Args("code") code: string,
    @CurrentRequestMeta() meta: RequestMeta,
  ): Promise<EventTicketPass | null> {
    return this.passes.execute(code.slice(0, 20), meta.ipAddress);
  }
}
