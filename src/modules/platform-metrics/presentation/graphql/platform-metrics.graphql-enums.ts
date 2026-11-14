import { registerEnumType } from "@nestjs/graphql";
import { MetricsGranularity } from "@/modules/platform-metrics/domain/metrics-period";

registerEnumType(MetricsGranularity, {
  name: "MetricsGranularity",
  description: "Tamanho de cada intervalo da série: dia, semana ou mês.",
});
