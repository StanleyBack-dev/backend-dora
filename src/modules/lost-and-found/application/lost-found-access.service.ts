import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { UserGroup } from "@/modules/access-control/domain/user-group";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";
import { UserLookupService } from "@/modules/identity/application/user-lookup.service";
import {
  FOUND_ITEM_REPOSITORY,
  type FoundItem,
  type FoundItemRepositoryPort,
} from "@/modules/lost-and-found/application/ports/found-item-repository.port";
import { isKept } from "@/modules/lost-and-found/domain/found-item";

// Every lost-and-found operation starts here: the caller's condominium must
// have the module (contracted apart). The gate and the managers see every
// item; a resident, the items still kept (a reserved one only when it is
// theirs or their unit's) and those they claimed.
@Injectable()
export class LostFoundAccessService {
  constructor(
    @Inject(FOUND_ITEM_REPOSITORY)
    private readonly items: FoundItemRepositoryPort,
    private readonly modules: ModuleAccessService,
    private readonly permissions: PermissionsService,
    private readonly users: UserLookupService,
  ) {}

  /** The condominium the caller works in, once the module is checked. */
  async condominiumOf(actor: AuthenticatedUser): Promise<string> {
    const condominiumId = tenantOf(actor);
    await this.modules.assertEnabled(condominiumId, AppModule.LOST_AND_FOUND);
    return condominiumId;
  }

  async canManage(actor: AuthenticatedUser): Promise<boolean> {
    return (await this.permissions.effectiveFor(actor)).has(
      Permission.LOST_FOUND_MANAGE,
    );
  }

  /** An item of the caller's condominium the caller may see. */
  async loadVisible(actor: AuthenticatedUser, id: string): Promise<FoundItem> {
    const condominiumId = await this.condominiumOf(actor);
    const item = await this.items.find(condominiumId, id);
    if (item && (await this.canSee(actor, item))) return item;
    throw AppException.from(APP_ERRORS.lostFound.notFound, undefined);
  }

  /** The caller's unit there (null: not a resident with a unit). */
  unitOf(actor: AuthenticatedUser, condominiumId: string) {
    return this.users.memberUnitId(actor.id, condominiumId);
  }

  /**
   * Whether a reserved item is the caller's: reserved for them, or for
   * their unit (without a resident named).
   */
  async isOwner(actor: AuthenticatedUser, item: FoundItem): Promise<boolean> {
    if (!item.ownerUnitId) return false;
    if (item.ownerUserId) return item.ownerUserId === actor.id;
    return (await this.unitOf(actor, item.condominiumId)) === item.ownerUnitId;
  }

  /**
   * The desk: any item; residents: kept ones (a reserved one only when it
   * is theirs), and those they claimed.
   */
  async canSee(actor: AuthenticatedUser, item: FoundItem): Promise<boolean> {
    if (await this.canManage(actor)) return true;
    if (isKept(item.status)) {
      if (!item.ownerUnitId || (await this.isOwner(actor, item))) return true;
    }
    const claims = await this.items.claimsOf(item.id);
    return claims.some((claim) => claim.userId === actor.id);
  }

  /**
   * Who is told of an item reserved when registered: the resident named
   * (while still living in the unit), otherwise every resident of the unit.
   */
  async ownerAudience(
    item: Pick<FoundItem, "condominiumId" | "ownerUnitId" | "ownerUserId">,
  ): Promise<string[]> {
    if (!item.ownerUnitId) return [];
    const residents = await this.users.activeUnitMemberIds(
      item.condominiumId,
      item.ownerUnitId,
    );
    return item.ownerUserId && residents.includes(item.ownerUserId)
      ? [item.ownerUserId]
      : residents;
  }

  /**
   * Who looks after the items there: the gate and the managers (their
   * roles; a member's own permission overrides are not considered here).
   */
  async staff(condominiumId: string): Promise<string[]> {
    const [gate, managers] = await Promise.all([
      this.users.activeMemberIds(condominiumId, UserGroup.CONCIERGE),
      this.users.activeMemberIds(condominiumId, UserGroup.ADMIN),
    ]);
    return [...new Set([...gate, ...managers])];
  }
}
