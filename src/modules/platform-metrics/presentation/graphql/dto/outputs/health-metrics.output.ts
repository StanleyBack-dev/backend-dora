import { Field, Int, ObjectType } from "@nestjs/graphql";

@ObjectType("HealthMetrics", {
  description: "O que precisa de atenção agora.",
})
export class HealthMetricsType {
  @Field(() => Int, {
    description: "Cadastros esperando análise há mais de 3 dias.",
  })
  staleEnrollments!: number;

  @Field(() => Int, {
    description: "Avisos que a fila desistiu de entregar (toda a plataforma).",
  })
  failedNotifications!: number;

  @Field(() => Int, {
    description: "Avisos na fila há mais de 1 hora (toda a plataforma).",
  })
  delayedNotifications!: number;

  @Field(() => Int, { description: "Condomínios ativos sem gestor ativo." })
  withoutManager!: number;

  @Field(() => Int, { description: "Condomínios ativos sem unidades." })
  withoutUnits!: number;

  @Field(() => Int, { description: "Solicitações de suporte sem resposta." })
  openSupport!: number;
}
