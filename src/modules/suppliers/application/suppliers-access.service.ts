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
 * The modules that work with suppliers, with who manages them there
 * (registers, edits, deactivates). A new module (maintenance, events…)
 * adds its line.
 */
const SUPPLIER_USERS: readonly {
  module: AppModule;
  manage: readonly Permission[];
}[] = [{ module: AppModule.PURCHASES, manage: [Permission.PURCHASES_MANAGE] }];

// Suppliers belong to no paid module: the registry opens to whoever manages
// them in a module that works with suppliers (contracted by the
// condominium).
@Injectable()
export class SuppliersAccessService {
  constructor(
    private readonly modules: ModuleAccessService,
    private readonly permissions: PermissionsService,
  ) {}

  /** The condominium, for whoever manages suppliers in some module. */
  async managedBy(actor: AuthenticatedUser): Promise<string> {
    const condominiumId = tenantOf(actor);
    const [enabled, granted] = await Promise.all([
      this.modules.enabled(condominiumId),
      this.permissions.effectiveFor(actor),
    ]);
    const allowed = SUPPLIER_USERS.some(
      (user) =>
        enabled.includes(user.module) &&
        user.manage.some((permission) => granted.has(permission)),
    );
    if (!allowed) {
      throw AppException.from(
        APP_ERRORS.accessControl.missingPermission,
        undefined,
      );
    }
    return condominiumId;
  }
}
