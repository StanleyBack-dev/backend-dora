import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { CondominiumLookupService } from "@/modules/condominiums/application/condominium-lookup.service";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";

export type ParcelRecipient = {
  userId: string;
  name: string;
  unitId: string;
  unitLabel: string;
};

/** Shortest search and most results (the field asks as the person types). */
export const RECIPIENT_SEARCH_MIN = 2;
export const RECIPIENT_SEARCH_LIMIT = 20;

// Registering a parcel by the resident's name instead of the unit: the
// residents (with a unit) whose name matches, searched by the database, with
// their unit, so the gate picks the right one.
@Injectable()
export class SearchParcelRecipientsUseCase {
  constructor(
    private readonly access: ParcelAccessService,
    private readonly users: UserLookupService,
    private readonly condominiums: CondominiumLookupService,
  ) {}

  async execute(
    actor: AuthenticatedUser,
    search: string,
  ): Promise<ParcelRecipient[]> {
    const condominiumId = await this.access.condominiumOf(actor);
    const term = search.trim().replace(/\s+/g, " ").slice(0, 60);
    if (term.length < RECIPIENT_SEARCH_MIN) return [];
    const residents = await this.users.searchResidents(
      condominiumId,
      term,
      RECIPIENT_SEARCH_LIMIT,
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
