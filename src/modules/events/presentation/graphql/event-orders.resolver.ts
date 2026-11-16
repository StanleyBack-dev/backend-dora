import { Args, ID, Mutation, Query, Resolver } from "@nestjs/graphql";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UuidArg } from "@/common/graphql/uuid-arg.pipe";
import { EventOrderAccessService } from "@/modules/events/application/event-order-access.service";
import { CancelEventOrderUseCase } from "@/modules/events/application/use-cases/cancel-event-order.use-case";
import { CreateEventOrderUseCase } from "@/modules/events/application/use-cases/create-event-order.use-case";
import { ListMyEventOrdersUseCase } from "@/modules/events/application/use-cases/list-my-event-orders.use-case";
import { SubmitOrderReceiptUseCase } from "@/modules/events/application/use-cases/submit-order-receipt.use-case";
import { SubmitAttendeeProofUseCase } from "@/modules/events/application/use-cases/submit-attendee-proof.use-case";
import { AttendeeInput } from "@/modules/events/presentation/graphql/dto/inputs/attendee.input";
import { EventOrderType } from "@/modules/events/presentation/graphql/dto/outputs/event-order.output";
import { toOrderType } from "@/modules/events/presentation/graphql/event-order.mapper";

// A member's own orders: order places, pay by PIX, send the receipt, give up.
@Resolver()
export class EventOrdersResolver {
  constructor(
    private readonly creating: CreateEventOrderUseCase,
    private readonly mine: ListMyEventOrdersUseCase,
    private readonly access: EventOrderAccessService,
    private readonly receipts: SubmitOrderReceiptUseCase,
    private readonly cancelling: CancelEventOrderUseCase,
    private readonly proofs: SubmitAttendeeProofUseCase,
  ) {}

  @Mutation(() => EventOrderType, {
    description:
      "Envia o documento de uma pessoa do pedido (imagem ou PDF em base64, até 1,2 MB).",
  })
  async submitEventAttendeeProof(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("orderId", { type: () => ID }, UuidArg()) orderId: string,
    @Args("attendeeId", { type: () => ID }, UuidArg()) attendeeId: string,
    @Args("file") file: string,
  ): Promise<EventOrderType> {
    return toOrderType(
      await this.proofs.execute(actor, orderId, attendeeId, file),
    );
  }

  @Query(() => [EventOrderType], {
    description: "Os meus pedidos para um evento (mais recentes primeiro).",
  })
  async myEventOrders(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, UuidArg()) eventId: string,
  ): Promise<EventOrderType[]> {
    return (await this.mine.execute(actor, eventId)).map(toOrderType);
  }

  @Query(() => EventOrderType, {
    description: "Um pedido: de quem o fez ou de quem confere os pagamentos.",
  })
  async eventOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<EventOrderType> {
    return toOrderType(await this.access.load(actor, id));
  }

  @Mutation(() => EventOrderType, {
    description:
      "Pede ingressos (ou a inscrição, se grátis) para si e convidados. Pago: as vagas ficam reservadas por 48 h aguardando o comprovante.",
  })
  async createEventOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("eventId", { type: () => ID }, UuidArg()) eventId: string,
    @Args("attendees", { type: () => [AttendeeInput] })
    attendees: AttendeeInput[],
  ): Promise<EventOrderType> {
    return toOrderType(await this.creating.execute(actor, eventId, attendees));
  }

  @Mutation(() => EventOrderType, {
    description:
      "Envia o comprovante do PIX (imagem ou PDF em base64, até 1,2 MB).",
  })
  async submitEventOrderReceipt(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
    @Args("file") file: string,
  ): Promise<EventOrderType> {
    return toOrderType(await this.receipts.execute(actor, id, file));
  }

  @Mutation(() => EventOrderType, {
    description: "Desiste de um pedido ainda não pago: as vagas voltam.",
  })
  async cancelEventOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Args("id", { type: () => ID }, UuidArg()) id: string,
  ): Promise<EventOrderType> {
    return toOrderType(await this.cancelling.execute(actor, id));
  }
}
