import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { LostFoundAccessService } from "@/modules/lost-and-found/application/lost-found-access.service";

export type FoundItemOwnerOption = {
  userId: string;
  name: string;
  unitId: string;
  unitLabel: string;
};

/** Shortest search and most results (the field asks as the person types). */
const SEARCH_MIN = 2;
const SEARCH_LIMIT = 20;

// Naming whose a found item is, by the resident's name: the residents (with
// a unit) whose name matches, with their unit, as when registering a
// parcel.
@Injectable()
export class SearchFoundItemOwnersUseCase {
  constructor(
    private readonly access: LostFoundAccessService,
    private readonly users: UserLookupService,
    private readonly condominiums: CondominiumLookupService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    search: string,
  ): Promise<FoundItemOwnerOption[]> {
    const condominiumId = await this.access.condominiumOf(actor);
    const term = search.trim().replace(/\s+/g, " ").slice(0, 60);
    if (term.length < SEARCH_MIN) return [];
    const residents = await this.users.searchResidents(
      condominiumId,
      term,
      SEARCH_LIMIT,
    );
    const labels = await this.condominiums.unitLabels(
      residents.map((resident) => resident.unitId),
    );
    return residents.flatMap((resident) => {
      const unitLabel = labels.get(resident.unitId);
      return unitLabel ? [{ ...resident, unitLabel }] : [];
    });
  }
}
