import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { unitLabel } from "@/modules/condominiums/domain/unit";
import {
  type ApprovedDependent,
  DependentLookupService,
} from "@/modules/dependents/application/dependent-lookup.service";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import type { PageRequest, Paginated } from "@/shared/application/pagination";
import {
  OBJECT_STORAGE,
  type ObjectStoragePort,
} from "@/shared/application/ports/object-storage.port";

/** A resident as the gate sees them. */
export type ResidentListing = {
  userId: string;
  name: string;
  /** Short-lived link to the profile photo (null: none). */
  photoUrl: string | null;
  unitId: string | null;
  /** "Bloco A · 101" (null: no unit). */
  unitLabel: string | null;
  unitComplement: string | null;
  phone: string | null;
  /** Approved dependents: name and relationship (no birth date). */
  dependents: Pick<ApprovedDependent, "id" | "name" | "relationship">[];
};

export type ResidentsFilter = { userId?: string; unitId?: string };

// The residents' directory (RESIDENTS_READ): who lives where and how to
// reach them, for the gate and the managers. Only the condominium's active
// residents, and only name, photo, unit, phone and approved dependents:
// e-mail, documents and birth dates stay with the management (LGPD).
@Injectable()
export class ListResidentsUseCase {
  constructor(
    private readonly users: UserLookupService,
    private readonly dependents: DependentLookupService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
  ) {}

  async list(
    actor: AuthenticatedUser,
    filter: ResidentsFilter,
    page: PageRequest,
  ): Promise<Paginated<ResidentListing>> {
    const found = await this.users.residents(tenantOf(actor), filter, page);
    const dependents = await this.dependents.approvedOfMany(
      found.items.map((resident) => resident.membershipId),
    );
    const items = await Promise.all(
      found.items.map(async (resident): Promise<ResidentListing> => ({
        userId: resident.userId,
        name: resident.name,
        photoUrl: resident.avatarKey
          ? await this.storage.signedReadUrl(resident.avatarKey)
          : null,
        unitId: resident.unitId,
        unitLabel:
          resident.unitNumber !== null
            ? unitLabel({
                street: resident.unitStreet,
                block: resident.unitBlock ?? "",
                number: resident.unitNumber,
              })
            : null,
        unitComplement: resident.unitComplement,
        phone: resident.phone,
        dependents: (dependents.get(resident.membershipId) ?? []).map(
          ({ id, name, relationship }) => ({ id, name, relationship }),
        ),
      })),
    );
    return { ...found, items };
  }

  /** The residents' names, for the name filter. */
  names(actor: AuthenticatedUser): Promise<{ id: string; name: string }[]> {
    return this.users.residentNames(tenantOf(actor));
  }
}
