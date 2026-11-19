import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("BroadcastStats", {
  description: "Os comunicados do condomínio em números (cards da página).",
})
export class BroadcastStatsType {
  @Field(() => Int)
  total!: number;

  @Field(() => Int, { description: "Enviados nos últimos 30 dias." })
  recent!: number;

  @Field(() => Int, { description: "Enviados também por e-mail." })
  withEmail!: number;

  @Field(() => Int, { description: "Pessoas alcançadas nos últimos 30 dias." })
  recentRecipients!: number;
}
