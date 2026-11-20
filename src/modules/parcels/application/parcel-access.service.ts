import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  PARCEL_REPOSITORY,
  type Parcel,
  type ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";

// Every parcels operation starts here: the caller's condominium must have
// the module (contracted apart). The gate and the managers see every
// parcel; a resident only those of their unit (and, when one was
// registered for a resident by name, only that resident).
@Injectable()
export class ParcelAccessService {
  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
    private readonly modules: ModuleAccessService,
    private readonly permissions: PermissionsService,
    private readonly users: UserLookupService,
  ) {}

  /** The condominium the caller works in, once the module is checked. */
  async condominiumOf(actor: AuthenticatedUser): Promise<string> {
    const condominiumId = tenantOf(actor);
    await this.modules.assertEnabled(condominiumId, AppModule.PARCELS);
    return condominiumId;
  }

  async canManage(actor: AuthenticatedUser): Promise<boolean> {
    return (await this.permissions.effectiveFor(actor)).has(
      Permission.PARCELS_MANAGE,
    );
  }

  /** The caller's unit there (null: not a resident with a unit). */
  unitOf(actor: AuthenticatedUser, condominiumId: string) {
    return this.users.memberUnitId(actor.id, condominiumId);
  }

  /** A parcel the caller may see: any (gate, managers) or their unit's. */
  async loadVisible(actor: AuthenticatedUser, id: string): Promise<Parcel> {
    const condominiumId = await this.condominiumOf(actor);
    const parcel = await this.parcels.find(condominiumId, id);
    if (parcel && (await this.canSee(actor, parcel))) return parcel;
    throw AppException.from(APP_ERRORS.parcels.notFound, undefined);
  }

  /**
   * Whether the caller may see this parcel (already in their condominium):
   * the unit's residents, or only its resident when it was registered for
   * them by name.
   */
  async canSee(actor: AuthenticatedUser, parcel: Parcel): Promise<boolean> {
    if (await this.canManage(actor)) return true;
    if (parcel.recipientUserId && parcel.recipientUserId !== actor.id) {
      return false;
    }
    const unitId = await this.unitOf(actor, parcel.condominiumId);
    return unitId !== null && unitId === parcel.unitId;
  }

  /**
   * Who is told about a parcel: the resident it was registered for (while
   * still living in the unit), otherwise every resident of the unit.
   */
  async audience(
    parcel: Pick<Parcel, "condominiumId" | "unitId" | "recipientUserId">,
  ): Promise<string[]> {
    if (!parcel.unitId) return [];
    const residents = await this.users.activeUnitMemberIds(
      parcel.condominiumId,
      parcel.unitId,
    );
    return parcel.recipientUserId && residents.includes(parcel.recipientUserId)
      ? [parcel.recipientUserId]
      : residents;
  }
}
