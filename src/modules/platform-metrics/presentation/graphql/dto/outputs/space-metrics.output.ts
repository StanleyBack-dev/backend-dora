import { Field, Int, ObjectType } from "@nestjs/graphql";
import { SpaceUsageType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/space-usage.output";
import { UsageByWeekdayType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/usage-by-weekday.output";
import { UsageByHourType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/usage-by-hour.output";

@ObjectType("SpaceMetrics", {
  description: "Uso dos espaços no período.",
})
export class SpaceMetricsType {
  @Field(() => Int)
  activeSpaces!: number;

  @Field(() => [SpaceUsageType], {
    description: "Os 10 espaços mais reservados.",
  })
  mostUsed!: SpaceUsageType[];

  @Field(() => [SpaceUsageType], {
    description: "Espaços ativos sem nenhuma reserva (até 10).",
  })
  unused!: SpaceUsageType[];

  @Field(() => Int)
  unusedCount!: number;

  @Field(() => [UsageByWeekdayType], {
    description: "Os 7 dias, de domingo a sábado.",
  })
  byWeekday!: UsageByWeekdayType[];

  @Field(() => [UsageByHourType], {
    description: "Só os horários com reservas.",
  })
  byHour!: UsageByHourType[];
}
