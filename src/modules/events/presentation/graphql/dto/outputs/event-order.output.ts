import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import { AttendeeType } from "@/modules/events/presentation/graphql/dto/outputs/attendee.output";
import { EventPixType } from "@/modules/events/presentation/graphql/dto/outputs/event-pix.output";
import "@/modules/events/presentation/graphql/events.graphql-enums";

@ObjectType("EventOrder", { description: "Pedido de ingressos de um evento." })
export class EventOrderType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  eventId!: string;

  @Field()
  eventTitle!: string;

  @Field({ description: "Código do pedido (também a referência do PIX)." })
  code!: string;

  @Field(() => EventOrderStatus)
  status!: EventOrderStatus;

  @Field(() => Int, { description: "Total em centavos." })
  totalCents!: number;

  @Field(() => ID, {
    nullable: true,
    description: "Quem fez o pedido (null: a conta foi removida).",
  })
  buyerId!: string | null;

  @Field(() => String, { nullable: true, description: "Quem fez o pedido." })
  buyerName!: string | null;

  @Field(() => ID, { nullable: true, description: "A unidade do pedido." })
  unitId!: string | null;

  @Field(() => String, { nullable: true })
  unitLabel!: string | null;

  @Field(() => [AttendeeType])
  attendees!: AttendeeType[];

  @Field(() => EventPixType, {
    nullable: true,
    description: "O PIX que recebe (nulo: pedido grátis).",
  })
  pix!: EventPixType | null;

  @Field(() => String, {
    nullable: true,
    description:
      "PIX copia e cola com o valor e o código (só enquanto aguarda pagamento).",
  })
  pixCode!: string | null;

  @Field(() => Date, {
    nullable: true,
    description: "Aguardando pagamento: até quando as vagas ficam reservadas.",
  })
  expiresAt!: Date | null;

  @Field(() => Date, { nullable: true })
  receiptSentAt!: Date | null;

  @Field(() => String, {
    nullable: true,
    description: "Tipo do comprovante (imagem ou PDF).",
  })
  receiptContentType!: string | null;

  /** Resolved into a signed link by the `receiptUrl` field. */
  receiptKey!: string | null;

  @Field(() => Date, { nullable: true })
  reviewedAt!: Date | null;

  @Field(() => String, { nullable: true })
  rejectReason!: string | null;

  @Field(() => Date, { nullable: true })
  cancelledAt!: Date | null;

  @Field()
  createdAt!: Date;
}
