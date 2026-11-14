import { Field, InputType, Int } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { OpeningHoursInput } from "@/modules/spaces/presentation/graphql/dto/inputs/opening-hours.input";
import { UnitLimitInput } from "@/modules/spaces/presentation/graphql/dto/inputs/unit-limit.input";

// Shape only: the ranges and the consistency between the fields are the
// domain's rules (space-rules.ts), with user-facing messages.
@InputType()
export class SpaceRulesInput {
  @Field(() => [OpeningHoursInput])
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => OpeningHoursInput)
  openingHours!: OpeningHoursInput[];

  @Field(() => Int)
  @IsInt()
  slotMinutes!: number;

  @Field(() => Int)
  @IsInt()
  minAdvanceHours!: number;

  @Field(() => Int)
  @IsInt()
  maxAdvanceDays!: number;

  @Field(() => UnitLimitInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => UnitLimitInput)
  unitLimit?: UnitLimitInput | null;

  @Field()
  @IsBoolean()
  requiresApproval!: boolean;

  @Field(() => Int)
  @IsInt()
  cancelUntilHours!: number;
}
