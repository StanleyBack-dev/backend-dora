import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "@/common/auth/authenticated-user";
import { requestFromContext } from "@/common/http/request-from-context";
import { ModuleAccessService } from "@/modules/condominiums/application/module-access.service";
import type { AppModule } from "@/modules/condominiums/domain/app-module";
import { REQUIRED_MODULE_KEY } from "@/modules/condominiums/presentation/decorators/require-module.decorator";

// Global guard, registered after the permissions guard. Operations marked
// with @RequireModule need the module on in the session's condominium;
// without a condominium the operation itself answers (it needs one).
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modules: ModuleAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<AppModule | undefined>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!module) return true;
    const condominiumId =
      requestFromContext<AuthenticatedRequest>(context).user?.condominiumId;
    if (!condominiumId) return true;
    await this.modules.assertEnabled(condominiumId, module);
    return true;
  }
}
