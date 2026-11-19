import type { Unit, UnitOccupancy } from "@/modules/condominiums/domain/unit";
import type { PageRequest, Paginated } from "@/shared/application/pagination";

/** A unit with how many active members are linked to it. */
export type UnitView = Unit & { residents: number };

/** Where a unit is: street (houses, "" otherwise), block and number. */
export type UnitPlace = Pick<Unit, "street" | "block" | "number">;

/** What narrows the units page (absent: any). */
export type UnitFilter = {
  unitId?: string;
  /** Exactly this block (the quadra of a house). */
  block?: string;
  /** Exactly this street (houses). */
  street?: string;
  occupancy?: UnitOccupancy;
};

/** Someone linked to a unit, as the units page shows them. */
export type UnitResident = {
  userId: string;
  name: string;
  /** Role in the condominium. */
  role: string;
  email: string;
  phone: string | null;
  /** Membership and account active. */
  active: boolean;
};

/** A unit with the people linked to it. */
export type UnitWithResidents = UnitView & { people: UnitResident[] };

export interface UnitRepositoryPort {
  /** Ordered by block, then number (numbers in numeric order). */
  list(condominiumId: string): Promise<UnitView[]>;
  /** A page of the filtered units, each with the people linked to it. */
  page(
    condominiumId: string,
    filter: UnitFilter,
    page: PageRequest,
  ): Promise<Paginated<UnitWithResidents>>;
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
