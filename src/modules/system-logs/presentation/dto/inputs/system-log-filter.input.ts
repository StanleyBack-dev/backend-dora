import { Field, InputType } from "@nestjs/graphql";
import {
  IsArray,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import type {
  SystemCategory,
  SystemLevel,
} from "@/common/logging/system-events";
import {
  SYSTEM_CATEGORIES,
  SYSTEM_LEVELS,
} from "@/modules/system-logs/domain/system-log";

@InputType()
export class SystemLogFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  from?: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsDate()
  to?: Date;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsIn(SYSTEM_LEVELS, { each: true })
  levels?: SystemLevel[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsIn(SYSTEM_CATEGORIES, { each: true })
  categories?: SystemCategory[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  environment?: string;
}
