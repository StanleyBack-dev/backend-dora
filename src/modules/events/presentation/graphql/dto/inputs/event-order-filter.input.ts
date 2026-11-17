import { Field, ID, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
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

  @Field(() => ID, { nullable: true, description: "Quem fez o pedido." })
  @IsOptional()
  @IsUUID()
  buyerId?: string;

  @Field(() => ID, { nullable: true, description: "A unidade do pedido." })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Field({ nullable: true, description: "O código do pedido." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;
}
