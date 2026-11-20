import { Field, ID, InputType } from "@nestjs/graphql";
import { IsOptional, IsUUID } from "class-validator";

@InputType({ description: "Filtros da consulta de moradores." })
export class ResidentsFilterInput {
  @Field(() => ID, { nullable: true, description: "Um morador (pelo nome)." })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @Field(() => ID, { nullable: true, description: "A unidade." })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}
