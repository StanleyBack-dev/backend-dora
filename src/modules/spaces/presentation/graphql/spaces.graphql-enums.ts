import { registerEnumType } from "@nestjs/graphql";
import { SpaceKind } from "@/modules/spaces/domain/space";
import { LimitPeriod } from "@/modules/spaces/domain/space-rules";

registerEnumType(SpaceKind, {
  name: "SpaceKind",
  description: "Tipo de espaço (quadra, salão de festas…).",
});
registerEnumType(LimitPeriod, {
  name: "LimitPeriod",
  description: "Período do limite de reservas por unidade.",
});
