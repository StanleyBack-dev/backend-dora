import { Field, InputType, Int } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { SpaceKind } from "@/modules/spaces/domain/space";
import { SpaceRulesInput } from "@/modules/spaces/presentation/graphql/dto/inputs/space-rules.input";
import "@/modules/spaces/presentation/graphql/spaces.graphql-enums";

@InputType({ description: "O formulário completo do espaço." })
export class SpaceInput {
  @Field()
  @IsString()
  @MaxLength(200)
  name!: string;

  @Field(() => SpaceKind)
  @IsEnum(SpaceKind)
  kind!: SpaceKind;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  capacity?: number | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(6000)
  usageRules?: string | null;

  @Field(() => SpaceRulesInput)
  @ValidateNested()
  @Type(() => SpaceRulesInput)
  rules!: SpaceRulesInput;
}
