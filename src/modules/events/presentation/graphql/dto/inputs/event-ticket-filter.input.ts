import { Field, InputType } from "@nestjs/graphql";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

@InputType({ description: "Filtros dos ingressos de um evento." })
export class EventTicketFilterInput {
  @Field({
    nullable: true,
    description:
      "Nome, quem pediu, unidade ou código (do ingresso ou do pedido).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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
