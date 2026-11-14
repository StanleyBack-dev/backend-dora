import { Field, Int, ObjectType } from "@nestjs/graphql";
import { MetricsGranularity } from "@/modules/platform-metrics/domain/metrics-period";
import "@/modules/platform-metrics/presentation/graphql/platform-metrics.graphql-enums";
import { BookingsPointType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/bookings-point.output";
import { CondominiumBookingsType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/condominium-bookings.output";

@ObjectType("BookingMetrics", {
  description: "Reservas com horário no período.",
})
export class BookingMetricsType {
  @Field(() => Int, { description: "Todas, em qualquer situação." })
  total!: number;

  @Field(() => Int)
  confirmed!: number;

  @Field(() => Int)
  pending!: number;

  @Field(() => Int)
  cancelled!: number;

  @Field(() => Int)
  rejected!: number;

  @Field(() => Int, {
    description: "Pendentes há mais de 48 horas (agora, não no período).",
  })
  stalePending!: number;

  @Field(() => MetricsGranularity, {
    description: "Tamanho de cada intervalo da série.",
  })
  granularity!: MetricsGranularity;

  @Field(() => [BookingsPointType], {
    description: "Reservas por dia, semana ou mês.",
  })
  series!: BookingsPointType[];

  @Field(() => [CondominiumBookingsType], {
    description: "Os 10 condomínios com mais reservas.",
  })
  byCondominium!: CondominiumBookingsType[];
}
