import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "@/common/auth/authenticated-user";
import { tenantOf } from "@/common/auth/tenant";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import { AppModule } from "@/modules/condominiums/domain/app-module";

// Every purchases operation starts here: the caller's condominium must have
// the module (contracted apart). The resolvers check the permissions.
@Injectable()
export class PurchasesAccessService {
  constructor(private readonly modules: ModuleAccessService) {}

  /** The condominium the caller works in, once the module is checked. */
  async condominiumOf(actor: AuthenticatedUser): Promise<string> {
    const condominiumId = tenantOf(actor);
    await this.modules.assertEnabled(condominiumId, AppModule.PURCHASES);
    return condominiumId;
  }
}
