import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType("SkippedDate", {
  description: "Data de uma recorrente que não pôde ser reservada.",
})
export class SkippedDateType {
  @Field(() => Date)
  startsAt!: Date;

  @Field(() => String)
  reason!: string;
}
