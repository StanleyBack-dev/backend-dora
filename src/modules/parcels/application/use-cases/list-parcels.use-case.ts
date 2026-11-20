import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { ParcelAccessService } from "@/modules/parcels/application/parcel-access.service";
import {
  PARCEL_REPOSITORY,
  type Parcel,
  type ParcelFilter,
  type ParcelOverview,
  type ParcelRepositoryPort,
} from "@/modules/parcels/application/ports/parcel-repository.port";
import {
  PARCEL_REMINDER_DAYS,
  type ParcelStatus,
} from "@/modules/parcels/domain/parcel";
import {
  paginate,
  type PageRequest,
  type Paginated,
} from "@/shared/application/pagination";
import { CLOCK, type ClockPort } from "@/shared/application/ports/clock.port";

const DAY_MS = 86_400_000;

// The condominium's parcels (gate, managers), filtered and paged by the
// database, their numbers at a glance, and a resident's unit parcels.
@Injectable()
export class ListParcelsUseCase {
  constructor(
    @Inject(PARCEL_REPOSITORY) private readonly parcels: ParcelRepositoryPort,
    private readonly access: ParcelAccessService,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async all(
    actor: AuthenticatedUser,
    filter: ParcelFilter,
    page: PageRequest,
  ): Promise<Paginated<Parcel>> {
    const condominiumId = await this.access.condominiumOf(actor);
    return this.parcels.list(condominiumId, filter, page);
  }

  async overview(actor: AuthenticatedUser): Promise<ParcelOverview> {
    const condominiumId = await this.access.condominiumOf(actor);
    const now = this.clock.now();
    const waitingSince = new Date(
      now.getTime() - PARCEL_REMINDER_DAYS * DAY_MS,
    );
    return this.parcels.overview(condominiumId, waitingSince, now);
  }

  /**
   * The caller's unit parcels they may see (none: not a resident with a
   * unit); those registered for another resident by name are left out.
   */
  async mine(
    actor: AuthenticatedUser,
    statuses: ParcelStatus[] | null,
    page: PageRequest,
  ): Promise<Paginated<Parcel>> {
    const condominiumId = await this.access.condominiumOf(actor);
    const unitId = await this.access.unitOf(actor, condominiumId);
    if (!unitId) {
      return paginate([], 0, page);
    }
    return this.parcels.listForUnit(unitId, actor.id, statuses, page);
  }
}
