import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("MemberStats", {
  description:
    "Os membros de um vínculo (moradores ou funcionários) em números (cards da página).",
})
export class MemberStatsType {
  @Field(() => Int)
  total!: number;

  @Field(() => Int, { description: "Vínculo e conta ativos." })
  active!: number;

  @Field(() => Int)
  inactive!: number;

  @Field(() => Int, { description: "Ativos que nunca entraram no app." })
  neverSignedIn!: number;
}
