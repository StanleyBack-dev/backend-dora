import { Field, ID, InputType, Int } from "@nestjs/graphql";
import { IsEnum, IsInt, IsOptional, IsUUID } from "class-validator";
import {
  TicketKind,
  TicketPriceMode,
} from "@/modules/events/domain/event-tickets";
import "@/modules/events/presentation/graphql/events.graphql-enums";

// Shape only: the domain checks audiences, prices and ages (event-tickets.ts).
@InputType()
export class TicketTypeInput {
  @Field(() => ID, {
    nullable: true,
    description: "Público já existente (vazio: novo).",
  })
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @Field(() => TicketKind, { description: "Público (uma vez por evento)." })
  @IsEnum(TicketKind)
  kind!: TicketKind;

  @Field(() => TicketPriceMode, { description: "Quanto paga." })
  @IsEnum(TicketPriceMode)
  priceMode!: TicketPriceMode;

  @Field(() => Int, {
    nullable: true,
    description: "Com Outro valor: o valor em centavos.",
  })
  @IsOptional()
  @IsInt()
  customPriceCents?: number | null;

  @Field(() => Int, { nullable: true, description: "Idade mínima." })
  @IsOptional()
  @IsInt()
  minAge?: number | null;

  @Field(() => Int, { nullable: true, description: "Idade máxima." })
  @IsOptional()
  @IsInt()
  maxAge?: number | null;
}
