import { Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { BookingMetricsType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/booking-metrics.output";
import { ParcelMetricsType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/parcel-metrics.output";
import { SpaceMetricsType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/space-metrics.output";
import { EngagementMetricsType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/engagement-metrics.output";
import { HealthMetricsType } from "@/modules/platform-metrics/presentation/graphql/dto/outputs/health-metrics.output";

@ObjectType("PlatformMetrics", {
  description: "Os números da plataforma no período.",
})
export class PlatformMetricsType {
  @Field(() => String, { description: "Primeiro dia (YYYY-MM-DD)." })
  from!: string;

  @Field(() => String, { description: "Último dia (YYYY-MM-DD)." })
  to!: string;

  @Field(() => Int)
  days!: number;

  @Field(() => ID, {
    nullable: true,
    description: "Filtro de condomínio (null: todos).",
  })
  condominiumId!: string | null;

  @Field(() => BookingMetricsType)
  bookings!: BookingMetricsType;

  @Field(() => ParcelMetricsType)
  parcels!: ParcelMetricsType;

  @Field(() => SpaceMetricsType)
  spaces!: SpaceMetricsType;

  @Field(() => EngagementMetricsType)
  engagement!: EngagementMetricsType;

  @Field(() => HealthMetricsType)
  health!: HealthMetricsType;
}
