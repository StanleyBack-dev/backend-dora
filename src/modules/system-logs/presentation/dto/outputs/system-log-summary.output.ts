import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("SystemLogSummary")
export class SystemLogSummaryType {
  @Field()
  level!: string;

  @Field(() => Int)
  last24h!: number;

  @Field(() => Int)
  last7d!: number;
}
