import { Field, Int, ObjectType } from "@nestjs/graphql";
import { InactiveCondominiumType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/inactive-condominium.output";

@ObjectType("EngagementMetrics", {
  description: "Moradores e acessos.",
})
export class EngagementMetricsType {
  @Field(() => Int, {
    description: "Pessoas com acesso (cada uma conta uma vez).",
  })
  members!: number;

  @Field(() => Int, { description: "Entraram no app nos últimos 7 dias." })
  active7d!: number;

  @Field(() => Int, { description: "Entraram no app nos últimos 30 dias." })
  active30d!: number;

  @Field(() => Int, { description: "Acessos criados no período." })
  newMembers!: number;

  @Field(() => Int, {
    description: "Cadastros pelo link recebidos no período.",
  })
  enrollments!: number;

  @Field(() => [InactiveCondominiumType], {
    description: "Até 10, os mais parados primeiro.",
  })
  inactiveCondominiums!: InactiveCondominiumType[];

  @Field(() => Int)
  inactiveCount!: number;
}
