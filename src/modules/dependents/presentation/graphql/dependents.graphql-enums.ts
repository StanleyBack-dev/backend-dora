import { registerEnumType } from "@nestjs/graphql";
import {
  DependentRelationship,
  DependentStatus,
} from "@/modules/dependents/domain/dependent";

registerEnumType(DependentStatus, {
  name: "DependentStatus",
  description: "Aguardando aprovação, aprovado ou recusado.",
});

registerEnumType(DependentRelationship, {
  name: "DependentRelationship",
  description: "Parentesco com o morador.",
});
