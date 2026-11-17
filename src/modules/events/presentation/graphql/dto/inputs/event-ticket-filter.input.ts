import { Field, ID, InputType } from "@nestjs/graphql";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

@InputType({ description: "Filtros dos ingressos de um evento." })
export class EventTicketFilterInput {
  @Field(() => ID, {
    nullable: true,
    description: "Uma pessoa (o id do ingresso).",
  })
  @IsOptional()
  @IsUUID()
  attendeeId?: string;

  @Field(() => ID, { nullable: true, description: "A unidade de quem pediu." })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Field({ nullable: true, description: "O código de um ingresso." })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @Field({
    nullable: true,
    description: "true: só quem já entrou; false: só quem ainda não entrou.",
  })
  @IsOptional()
  @IsBoolean()
  checkedIn?: boolean;

  @Field({ nullable: true, description: "O tipo de ingresso (pelo nome)." })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  ticketName?: string;

  @Field({
    nullable: true,
    description: "true: só convidados de fora; false: só do condomínio.",
  })
  @IsOptional()
  @IsBoolean()
  outside?: boolean;

  @Field({
    nullable: true,
    description: "true: só quem fez o pedido; false: só os acompanhantes.",
  })
  @IsOptional()
  @IsBoolean()
  buyer?: boolean;
}
