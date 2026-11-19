import { Field, ID, InputType } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import {
  DependentRelationship,
  DependentStatus,
} from "@/modules/dependents/domain/dependent";
import "@/modules/dependents/presentation/graphql/dependents.graphql-enums";

@InputType({ description: "O que filtra a lista de dependentes da gestão." })
export class DependentReviewFilterInput {
  @Field(() => DependentStatus, { nullable: true })
  @IsOptional()
  @IsEnum(DependentStatus)
  status?: DependentStatus;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  dependentId?: string;

  @Field(() => ID, {
    nullable: true,
    description: "O morador que cadastrou (id do usuário).",
  })
  @IsOptional()
  @IsUUID()
  holderId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @Field(() => DependentRelationship, { nullable: true })
  @IsOptional()
  @IsEnum(DependentRelationship)
  relationship?: DependentRelationship;
}
