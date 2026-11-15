import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("SupportContribution", {
  description: "Um apoio recebido por Pix.",
})
export class SupportContributionType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  supporterId!: string;

  @Field(() => Int)
  amountCents!: number;

  @Field({ description: "YYYY-MM-DD." })
  receivedOn!: string;

  @Field(() => String, { nullable: true })
  note!: string | null;

  @Field()
  createdAt!: Date;
}
