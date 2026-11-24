import { Field, InputType, Int } from "@nestjs/graphql";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { INDICATOR_LIMITS } from "@/modules/purchases/domain/purchase-indicators";

@InputType({ description: "Um ano ou um mês dele." })
export class IndicatorPeriodInput {
  @Field(() => Int)
  @IsInt()
  @Min(INDICATOR_LIMITS.minYear)
  @Max(INDICATOR_LIMITS.maxYear)
  year!: number;

  @Field(() => Int, { nullable: true, description: "1–12 (vazio: o ano)." })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number | null;
}
