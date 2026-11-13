import type { Unit } from "@/modules/condominiums/domain/unit";

/** A unit with how many active members are linked to it. */
export type UnitView = Unit & { residents: number };

export type UnitPlace = Pick<Unit, "block" | "number">;

export interface UnitRepositoryPort {
  /** Ordered by block, then number (numbers in numeric order). */
  list(condominiumId: string): Promise<UnitView[]>;
  findById(condominiumId: string, id: string): Promise<UnitView | null>;
  findByIds(ids: readonly string[]): Promise<Unit[]>;
  /** Inserts every unit or none. */
  createMany(
    condominiumId: string,
    units: readonly UnitPlace[],
  ): Promise<Unit[]>;
  update(id: string, patch: UnitPlace): Promise<void>;
  delete(id: string): Promise<void>;
}

export const UNIT_REPOSITORY = Symbol("UNIT_REPOSITORY");
