import type { Space, SpaceDetails } from "@/modules/spaces/domain/space";
import type { SpaceRules } from "@/modules/spaces/domain/space-rules";

export type SpaceData = SpaceDetails & { rules: SpaceRules };

export interface SpaceRepositoryPort {
  /** The condominium's spaces by name (inactive ones only when asked). */
  list(condominiumId: string, includeInactive: boolean): Promise<Space[]>;
  /** Only when it belongs to the condominium. */
  find(condominiumId: string, id: string): Promise<Space | null>;
  /** Same name in the condominium, case-insensitive. */
  findByName(condominiumId: string, name: string): Promise<Space | null>;
  create(condominiumId: string, data: SpaceData): Promise<Space>;
  update(
    id: string,
    patch: Partial<SpaceData> & { active?: boolean },
  ): Promise<Space>;
  delete(id: string): Promise<void>;
}

export const SPACE_REPOSITORY = Symbol("SPACE_REPOSITORY");
