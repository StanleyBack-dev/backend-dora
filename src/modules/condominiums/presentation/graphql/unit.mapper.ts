import type { UnitView } from "@/modules/condominiums/application/ports/unit-repository.port";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import type { UnitType } from "@/modules/condominiums/presentation/graphql/dto/outputs/unit.output";

export const toUnitType = (unit: UnitView): UnitType => ({
  ...unit,
  label: unitLabel(unit),
});
