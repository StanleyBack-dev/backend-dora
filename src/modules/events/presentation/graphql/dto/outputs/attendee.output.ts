import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { AttendeeSource } from "@/modules/events/domain/event-order";
import "@/modules/events/presentation/graphql/events.graphql-enums";

@ObjectType("EventAttendee", { description: "Uma pessoa de um pedido." })
export class AttendeeType {
  @Field(() => ID)
  id!: string;

  @Field(() => AttendeeSource)
  source!: AttendeeSource;

  @Field(() => ID, {
    nullable: true,
    description: "O dependente, quando a pessoa é um (DEPENDENT).",
  })
  dependentId!: string | null;

  @Field()
  name!: string;

  @Field(() => Int, { description: "Idade no dia do evento." })
  age!: number;

  @Field({ description: "Convidado de fora do condomínio." })
  outside!: boolean;

  @Field(() => String, {
    nullable: true,
    description: "Ingresso (como era no pedido).",
  })
  ticketName!: string | null;

  @Field(() => Int, { description: "Preço em centavos (como era no pedido)." })
  priceCents!: number;

  @Field({
    description:
      "O ingresso pede documento (desconto sem idade comprovada, ou estudante, PcD, professor).",
  })
  needsProof!: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      "Código do ingresso (QR), só com o pedido confirmado (null: ainda não vale).",
  })
  ticketCode!: string | null;

  @Field(() => Date, {
    nullable: true,
    description: "Quando entrou pela portaria.",
  })
  checkedInAt!: Date | null;

  /** Resolved into a signed link by the `proofUrl` field. */
  proofKey!: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Tipo do documento enviado (imagem ou PDF).",
  })
  proofContentType!: string | null;
}
