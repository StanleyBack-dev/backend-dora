import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("SupportQuota", { description: "Limite diário de solicitações." })
export class SupportQuotaType {
  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  sentToday!: number;

  @Field(() => Int)
  remaining!: number;

  @Field(() => Date, {
    nullable: true,
    description: "Quando poderá enviar de novo (vazio: já pode).",
  })
  nextAllowedAt!: Date | null;
}
