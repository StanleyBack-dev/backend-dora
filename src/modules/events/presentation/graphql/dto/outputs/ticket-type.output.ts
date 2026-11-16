import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import {
  TicketKind,
  TicketPriceMode,
} from "@/modules/events/domain/event-tickets";
import "@/modules/events/presentation/graphql/events.graphql-enums";

@ObjectType("TicketType", {
  description: "Público aceito num evento, com o que paga.",
})
export class TicketTypeType {
  @Field(() => ID)
  id!: string;

  @Field(() => TicketKind)
  kind!: TicketKind;

  @Field({ description: 'O nome do público ("Criança").' })
  name!: string;

  @Field(() => TicketPriceMode)
  priceMode!: TicketPriceMode;

  @Field(() => Int, { nullable: true, description: "Com Outro valor." })
  customPriceCents!: number | null;

  @Field(() => Int, { description: "Preço em centavos (0: grátis)." })
  priceCents!: number;

  @Field(() => Int, { nullable: true })
  minAge!: number | null;

  @Field(() => Int, { nullable: true })
  maxAge!: number | null;
}
