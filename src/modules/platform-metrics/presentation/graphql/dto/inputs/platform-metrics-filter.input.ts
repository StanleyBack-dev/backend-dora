import { Field, ID, InputType } from "@nestjs/graphql";
import { IsOptional, IsUUID, Matches } from "class-validator";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@InputType()
export class PlatformMetricsFilterInput {
  @Field({
    nullable: true,
    description: "Primeiro dia (YYYY-MM-DD). Padrão: 30 dias antes do fim.",
  })
  @IsOptional()
  @Matches(DATE)
  from?: string;

  @Field({
    nullable: true,
    description: "Último dia (YYYY-MM-DD). Padrão: hoje.",
  })
  @IsOptional()
  @Matches(DATE)
  to?: string;

  @Field(() => ID, {
    nullable: true,
    description: "Um condomínio (vazio: todos).",
  })
  @IsOptional()
  @IsUUID()
  condominiumId?: string;
}
