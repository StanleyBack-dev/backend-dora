import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { CondominiumStatus } from "@/modules/condominiums/domain/condominium";
import "@/modules/condominiums/presentation/graphql/condominiums.graphql-enums";

@InputType()
export class CondominiumFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field(() => CondominiumStatus, { nullable: true })
  @IsOptional()
  @IsEnum(CondominiumStatus)
  status?: CondominiumStatus;
}
