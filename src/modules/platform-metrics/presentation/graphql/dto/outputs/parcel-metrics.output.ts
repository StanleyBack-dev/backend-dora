import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { MetricsGranularity } from "@/modules/platform-metrics/domain/metrics-period";
import "@/modules/platform-metrics/presentation/graphql/platform-metrics.graphql-enums";
import { CondominiumParcelsType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/condominium-parcels.output";
import { ParcelsPointType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/parcels-point.output";

@ObjectType("ParcelMetrics", {
  description: "Encomendas recebidas no período e as que aguardam agora.",
})
export class ParcelMetricsType {
  @Field(() => Int, { description: "Condomínios com o módulo ligado." })
  condominiumsWithModule!: number;

  @Field(() => Int, { description: "Recebidas no período." })
  received!: number;

  @Field(() => Int, { description: "Delas, retiradas." })
  pickedUp!: number;

  @Field(() => Int, { description: "Delas, devolvidas ao remetente." })
  returned!: number;

  @Field(() => Int, { description: "Delas, canceladas (registro por engano)." })
  cancelled!: number;

  @Field(() => Int, { description: "Delas, perecíveis." })
  perishable!: number;

  @Field(() => Float, {
    nullable: true,
    description:
      "Tempo médio até a retirada (horas), das retiradas no período (nulo: nenhuma).",
  })
  averagePickupHours!: number | null;

  @Field(() => Int, { description: "Aguardando retirada agora." })
  waitingNow!: number;

  @Field(() => Int, { description: "Aguardando há mais de 3 dias, agora." })
  stuckNow!: number;

  @Field(() => Int, { description: "Perecíveis com o prazo vencido, agora." })
  perishableOverdueNow!: number;

  @Field(() => MetricsGranularity)
  granularity!: MetricsGranularity;

  @Field(() => [ParcelsPointType])
  series!: ParcelsPointType[];

  @Field(() => [CondominiumParcelsType], {
    description: "Os 10 condomínios que mais recebem.",
  })
  byCondominium!: CondominiumParcelsType[];
}
