import { Field, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { EventOrderStatus } from "@/modules/events/domain/event-order";
import "@/modules/events/presentation/graphql/events.graphql-enums";

@InputType({ description: "Filtros dos pedidos de um evento." })
export class EventOrderFilterInput {
  @Field(() => [EventOrderStatus], {
    nullable: true,
    description: "Só estas situações (vazio: todas).",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(EventOrderStatus, { each: true })
  statuses?: EventOrderStatus[];

  @Field({
    nullable: true,
    description: "Quem pediu, código do pedido, unidade ou nome de uma pessoa.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
