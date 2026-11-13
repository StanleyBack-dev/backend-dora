import { Inject, Injectable } from "@nestjs/common";
import {
  CONDOMINIUM_REPOSITORY,
  type CondominiumRepositoryPort,
} from "@/modules/condominiums/application/ports/condominium-repository.port";
import {
  UNIT_REPOSITORY,
  type UnitRepositoryPort,
  type UnitView,
} from "@/modules/condominiums/application/ports/unit-repository.port";
import { type Condominium } from "@/modules/condominiums/domain/condominium";
import { unitLabel, type Unit } from "@/modules/condominiums/domain/unit";

@Injectable()
export class CondominiumLookupService {
  constructor(
    @Inject(CONDOMINIUM_REPOSITORY)
    private readonly condominiums: CondominiumRepositoryPort,
    @Inject(UNIT_REPOSITORY) private readonly units: UnitRepositoryPort,
  ) {}

  find(id: string): Promise<Condominium | null> {
    return this.condominiums.findById(id);
  }

  /** The unit, only when it belongs to this condominium. */
  async unitIn(condominiumId: string, unitId: string): Promise<Unit | null> {
    return this.units.findById(condominiumId, unitId);
  }

  unitsOf(condominiumId: string): Promise<UnitView[]> {
    return this.units.list(condominiumId);
  }

  /** "Bloco A · 101" for each unit id (missing ids are left out). */
  async unitLabels(ids: readonly string[]): Promise<Map<string, string>> {
    const units = await this.units.findByIds([...new Set(ids)]);
    return new Map(units.map((unit) => [unit.id, unitLabel(unit)]));
  }
}
