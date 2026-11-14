import { Field, Int, ObjectType } from "@nestjs/graphql";
import { LimitPeriod } from "@/modules/spaces/domain/space-rules";
import "@/modules/spaces/presentation/graphql/spaces.graphql-enums";

@ObjectType("UnitLimit", {
  description: "No máximo `count` reservas por unidade a cada período.",
})
export class UnitLimitType {
  @Field(() => Int)
  count!: number;

  @Field(() => LimitPeriod)
  period!: LimitPeriod;
}
