import { Field, InputType, Int } from "@nestjs/graphql";
import { IsEnum, IsInt, Max, Min } from "class-validator";
import { LimitPeriod } from "@/modules/spaces/domain/space-rules";
import "@/modules/spaces/presentation/graphql/spaces.graphql-enums";

@InputType()
export class UnitLimitInput {
  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(100)
  count!: number;

  @Field(() => LimitPeriod)
  @IsEnum(LimitPeriod)
  period!: LimitPeriod;
}
