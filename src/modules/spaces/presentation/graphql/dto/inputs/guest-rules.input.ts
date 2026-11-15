import { Field, InputType, Int } from "@nestjs/graphql";
import { IsBoolean, IsInt, IsOptional } from "class-validator";

// Shape only: the range is the domain's rule (space-rules.ts).
@InputType()
export class GuestRulesInput {
  @Field({ description: "Quem reserva pode levar convidados." })
  @IsBoolean()
  allowed!: boolean;

  @Field(() => Int, {
    nullable: true,
    description: "Máximo de convidados por reserva (vazio: sem limite).",
  })
  @IsOptional()
  @IsInt()
  max?: number | null;

  @Field({ description: "A portaria exige o documento de cada convidado." })
  @IsBoolean()
  documentRequired!: boolean;
}
