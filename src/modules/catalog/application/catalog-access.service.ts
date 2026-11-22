import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { APP_ERRORS } from "@/common/exceptions/app-errors.catalog";
import { AppException } from "@/common/exceptions/app-exception";
import { PermissionsService } from "@/modules/access-control/application/permissions.service";
import { Permission } from "@/modules/access-control/domain/permission";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";

/**
 * The modules that use the catalog, with who uses it there (reads the
 * selects and registers a product or brand while filling something in) and
 * who manages it (renames, deactivates). A new module adds its line.
 */
const CATALOG_USERS: readonly {
  module: AppModule;
  use: readonly Permission[];
  manage: readonly Permission[];
}[] = [
  {
    module: AppModule.PURCHASES,
    use: [Permission.PURCHASES_REQUEST, Permission.PURCHASES_MANAGE],
    manage: [Permission.PURCHASES_MANAGE],
  },
];

// The catalog belongs to no paid module: it opens to whoever works in a
// module that uses it (contracted by the condominium) with one of that
// module's permissions.
@Injectable()
export class CatalogAccessService {
  constructor(
    private readonly modules: ModuleAccessService,
    private readonly permissions: PermissionsService,
  ) {}

  private async check(
    actor: AuthenticatedUser,
    level: "use" | "manage",
  ): Promise<string> {
    const condominiumId = tenantOf(actor);
    const [enabled, granted] = await Promise.all([
      this.modules.enabled(condominiumId),
      this.permissions.effectiveFor(actor),
    ]);
    const allowed = CATALOG_USERS.some(
      (user) =>
        enabled.includes(user.module) &&
        user[level].some((permission) => granted.has(permission)),
    );
    if (!allowed) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
      );
    }
    return condominiumId;
  }

  /** The condominium, for whoever uses the catalog in some module. */
  usableBy(actor: AuthenticatedUser): Promise<string> {
    return this.check(actor, "use");
  }

  /** The condominium, for whoever manages the catalog in some module. */
  managedBy(actor: AuthenticatedUser): Promise<string> {
    return this.check(actor, "manage");
  }
}
