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
  PURCHASE_REQUEST_REPOSITORY,
  type PurchaseRequestRepositoryPort,
  type PurchaseRequestScope,
} from "@/modules/purchases/application/ports/purchase-request-repository.port";
import type { PurchaseRequest } from "@/modules/purchases/domain/purchase-request";

// Every purchases operation starts here: the caller's condominium must have
// the module (contracted apart). The resolvers check the permissions; here,
// whose requests the caller sees: the management (PURCHASES_MANAGE) and the
// approvers (PURCHASES_APPROVE) every one, whoever only asks for purchases
// (PURCHASES_REQUEST) their own.
@Injectable()
export class PurchasesAccessService {
  constructor(
    private readonly modules: ModuleAccessService,
    private readonly permissions: PermissionsService,
    private readonly users: UserLookupService,
    @Inject(PURCHASE_REQUEST_REPOSITORY)
    private readonly requests: PurchaseRequestRepositoryPort,
  ) {}

  /** The condominium the caller works in, once the module is checked. */
  async condominiumOf(actor: AuthenticatedUser): Promise<string> {
    const condominiumId = tenantOf(actor);
    await this.modules.assertEnabled(condominiumId, AppModule.PURCHASES);
    return condominiumId;
  }

  /**
   * The requests the caller sees: all (management) or their own (who only
   * asks for purchases); anyone else is refused.
   */
  async scopeOf(actor: AuthenticatedUser): Promise<PurchaseRequestScope> {
    const condominiumId = await this.condominiumOf(actor);
    const granted = await this.permissions.effectiveFor(actor);
    if (
      granted.has(Permission.PURCHASES_MANAGE) ||
      granted.has(Permission.PURCHASES_APPROVE)
    ) {
      return { condominiumId, requesterId: null };
    }
    if (granted.has(Permission.PURCHASES_REQUEST)) {
      return { condominiumId, requesterId: actor.id };
    }
    throw AppException.from(
      APP_ERRORS.accessControl.missingPermission,
      undefined,
    );
  }

  /**
   * The condominium, once the caller has at least one of the permissions
   * (e.g. the quotes are read by the management and the approvers).
   */
  async condominiumWithAny(
    actor: AuthenticatedUser,
    ...permissions: Permission[]
  ): Promise<string> {
    const condominiumId = await this.condominiumOf(actor);
    const granted = await this.permissions.effectiveFor(actor);
    if (!permissions.some((permission) => granted.has(permission))) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
      );
    }
    return condominiumId;
  }

  /** A request of the caller's condominium the caller may see. */
  async loadRequest(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<PurchaseRequest> {
    const scope = await this.scopeOf(actor);
    const request = await this.requests.find(scope.condominiumId, id);
    if (
      request &&
      (scope.requesterId === null || request.requestedById === actor.id)
    ) {
      return request;
    }
    throw AppException.from(APP_ERRORS.purchases.requestNotFound, undefined);
  }

  /**
   * Who looks after the purchases there: the managers (their role; a
   * member's own permission overrides are not considered here).
   */
  managers(condominiumId: string): Promise<string[]> {
    return this.users.activeMemberIds(condominiumId, UserGroup.ADMIN);
  }

  /**
   * Who is told a purchase waits for approval: the managers too (by role;
   * deciding itself checks PURCHASES_APPROVE, so one who lost it is told
   * but can't decide).
   */
  approvers(condominiumId: string): Promise<string[]> {
    return this.managers(condominiumId);
  }
}
